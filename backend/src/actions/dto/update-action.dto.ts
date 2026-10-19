import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateActionDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional()
  @IsIn([
    'ANALYSE_IMPACT',
    'MISE_A_JOUR_METHODE',
    'FORMATION',
    'VERIFICATION',
    'AUTRE',
  ])
  actionType?: string;
  @IsOptional() @IsInt() ownerId?: number;
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status?: string;
  @IsOptional() @IsString() @MaxLength(2000) impact?: string;
  @IsOptional() @IsString() @MaxLength(2000) decision?: string;
  @IsOptional() @IsDateString() dueDate?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) progressComment?: string;
  @IsOptional() @IsString() @MaxLength(10000) result?: string;
}
