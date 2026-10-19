import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { AuditService } from './audit.service';

interface AuthenticatedRequest extends Request {
  user?: { id?: number };
}

interface AuditDescriptor {
  action: string;
  entity: string;
  entityId?: number;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const descriptor = this.describe(request.method, request.originalUrl);

    if (!descriptor) return next.handle();

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        try {
          const response = descriptor.action === 'DOWNLOAD_REPORT'
            ? { downloaded: true }
            : this.sanitize(result);
          const responseId = this.readId(response);
          const loginUserId = descriptor.action === 'LOGIN' ? this.readNestedUserId(response) : undefined;
          const logoutUserId = descriptor.action === 'LOGOUT'
            ? await this.readCookieUserId(request)
            : undefined;
          const actorId = request.user?.id ?? loginUserId ?? logoutUserId;
          const authenticationEntityId = descriptor.entity === 'auth'
            ? actorId
            : undefined;

          await this.auditService.log({
            userId: actorId,
            action: descriptor.action,
            entity: descriptor.entity,
            entityId: descriptor.entityId ?? responseId ?? authenticationEntityId,
            afterValue: response,
            ipAddress: request.ip,
          });
        } catch (error) {
          this.logger.error(
            'Impossible d’enregistrer une opération dans le journal d’audit.',
            error instanceof Error ? error.stack : String(error),
          );
        }

        return result;
      }),
      catchError((error: unknown) => {
        if (descriptor.action !== 'LOGIN') return throwError(() => error);
        const email = typeof request.body?.email === 'string'
          ? request.body.email.trim().toLowerCase().slice(0, 254)
          : undefined;
        return from(this.auditService.log({
          action: 'LOGIN_FAILED',
          entity: 'auth',
          afterValue: email ? { email } : undefined,
          ipAddress: request.ip,
        }).catch((auditError: unknown) => {
          this.logger.error('Impossible de journaliser un échec de connexion.',
            auditError instanceof Error ? auditError.stack : String(auditError));
        })).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }

  private describe(method: string, originalUrl: string): AuditDescriptor | null {
    const path = originalUrl.split('?')[0].replace(/^\/api\/v1/, '');

    const reportDownload = path.match(/^\/reports\/(\d+)\/download$/);
    if (method === 'GET' && reportDownload) {
      return {
        action: 'DOWNLOAD_REPORT',
        entity: 'reports',
        entityId: Number(reportDownload[1]),
      };
    }

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return null;

    // Ces opérations produisent déjà un audit métier détaillé avant/après.
    if (
      path.startsWith('/users') ||
      path.startsWith('/sources') ||
      path.startsWith('/taxonomy') ||
      path.startsWith('/actions') ||
      /^\/watch-items\/\d+\/ai-analysis(?:\/\d+\/review)?$/.test(path) ||
      /^\/watch-items\/\d+\/(review|publish|archive|qualification)$/.test(path) ||
      /^\/connectors\/\d+\/(run|retry)$/.test(path)
    ) {
      return null;
    }

    if (method === 'POST' && path === '/auth/login') return { action: 'LOGIN', entity: 'auth' };
    if (method === 'POST' && path === '/auth/logout') return { action: 'LOGOUT', entity: 'auth' };
    if (method === 'POST' && path === '/connectors') return { action: 'CREATE_CONNECTOR', entity: 'connectors' };

    const connectorTest = path.match(/^\/connectors\/(\d+)\/test$/);
    if (method === 'POST' && connectorTest) {
      return { action: 'TEST_CONNECTOR', entity: 'connectors', entityId: Number(connectorTest[1]) };
    }

    const favorite = path.match(/^\/favorites\/(\d+)$/);
    if (favorite) {
      return {
        action: method === 'POST' ? 'ADD_FAVORITE' : 'REMOVE_FAVORITE',
        entity: 'watch_items',
        entityId: Number(favorite[1]),
      };
    }

    if (method === 'POST' && path === '/saved-views') return { action: 'CREATE_SAVED_VIEW', entity: 'saved_views' };
    const savedView = path.match(/^\/saved-views\/(\d+)$/);
    if (method === 'DELETE' && savedView) {
      return { action: 'DELETE_SAVED_VIEW', entity: 'saved_views', entityId: Number(savedView[1]) };
    }

    if (method === 'POST' && path === '/subscriptions') return { action: 'CREATE_SUBSCRIPTION', entity: 'subscriptions' };
    const subscription = path.match(/^\/subscriptions\/(\d+)$/);
    if (method === 'DELETE' && subscription) {
      return { action: 'DELETE_SUBSCRIPTION', entity: 'subscriptions', entityId: Number(subscription[1]) };
    }

    const notification = path.match(/^\/notifications\/(\d+)\/read$/);
    if (method === 'PATCH' && notification) {
      return { action: 'READ_NOTIFICATION', entity: 'notifications', entityId: Number(notification[1]) };
    }

    if (method === 'POST' && path === '/reports') return { action: 'GENERATE_REPORT', entity: 'reports' };

    return null;
  }

  private sanitize(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;

    const blocked = new Set(['password', 'passwordHash', 'accessToken', 'token']);
    const visited = new WeakSet<object>();
    const clean = (input: unknown, depth = 0): unknown => {
      if (depth > 8) return '[Valeur imbriquée masquée]';
      if (input instanceof Date) return input.toISOString();
      if (Array.isArray(input)) return input.map((entry) => clean(entry, depth + 1));
      if (!input || typeof input !== 'object') return input;
      if (visited.has(input)) return '[Référence circulaire masquée]';
      visited.add(input);
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([key]) => !blocked.has(key))
          .map(([key, entry]) => [key, clean(entry, depth + 1)]),
      );
    };

    return clean(value) as Record<string, unknown>;
  }

  private readId(value: Record<string, unknown> | null) {
    return typeof value?.id === 'number' ? value.id : undefined;
  }

  private readNestedUserId(value: Record<string, unknown> | null) {
    const user = value?.user;
    if (!user || typeof user !== 'object') return undefined;
    const id = (user as Record<string, unknown>).id;
    return typeof id === 'number' ? id : undefined;
  }

  private async readCookieUserId(request: AuthenticatedRequest) {
    const token = request.cookies?.access_token;
    if (typeof token !== 'string') return undefined;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: number }>(token);
      return typeof payload.sub === 'number' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
