import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const AUDIT_GROUPS = [
  'all', 'users', 'watch', 'sources', 'taxonomy', 'actions', 'alerts', 'reports', 'access',
] as const;

export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(AUDIT_GROUPS)
  group: AuditGroup = 'all';
}
