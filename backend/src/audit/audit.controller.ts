import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './audit-query.dto';
@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private service: AuditService) {}
  @Get() @Roles('ADMIN', 'RESPONSABLE_VEILLE') list(@Query() query: AuditQueryDto) {
    return this.service.list(query);
  }
}
