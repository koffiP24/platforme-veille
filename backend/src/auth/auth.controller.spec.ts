import { ThrottlerGuard } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  it('délègue la connexion au service et pose le cookie sécurisé', async () => {
    const user = { id: 1, email: 'admin@veille.local', roles: ['ADMIN'] };
    const authService = {
      accessTtlSeconds: 8 * 3600,
      refreshTtlSeconds: 7 * 86400,
      login: vi.fn().mockResolvedValue({
        accessToken: 'jwt-test', refreshToken: 'refresh-test', user,
      }),
      refresh: vi.fn().mockResolvedValue({
        accessToken: 'new-jwt', refreshToken: 'new-refresh',
      }),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PasswordResetService, useValue: {
          forgotPassword: vi.fn(), resetPassword: vi.fn(), validateResetToken: vi.fn(),
        } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const response = { cookie: vi.fn() } as any;
    const result = await module.get(AuthController).login(
      { email: 'admin@veille.local', password: 'Admin123!' },
      response,
    );

    expect(authService.login).toHaveBeenCalledOnce();
    expect(response.cookie).toHaveBeenCalledWith(
      'access_token',
      'jwt-test',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000 }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-test',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth', maxAge: 7 * 86400 * 1000 }),
    );
    expect(result).toEqual({ user });

    await module.get(AuthController).refresh(
      { cookies: { refresh_token: 'refresh-test' } } as never,
      response,
    );
    expect(authService.refresh).toHaveBeenCalledWith('refresh-test');
    expect(response.cookie).toHaveBeenCalledWith(
      'access_token', 'new-jwt', expect.any(Object),
    );

    response.clearCookie = vi.fn();
    await module.get(AuthController).logout(
      { cookies: { refresh_token: 'new-refresh' } } as never,
      response,
    );
    expect(authService.logout).toHaveBeenCalledWith('new-refresh');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'refresh_token', expect.objectContaining({ path: '/api/v1/auth' }),
    );
  });
});
