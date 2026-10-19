import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateActionDto {
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsIn([
    'ANALYSE_IMPACT',
    'MISE_A_JOUR_METHODE',
    'FORMATION',
    'VERIFICATION',
    'AUTRE',
  ])
  actionType: string;
  @IsOptional() @IsString() @MaxLength(2000) impact?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsInt() ownerId: number;
  @IsOptional() @IsString() @MaxLength(5000) progressComment?: string;
  @IsOptional() @IsString() @MaxLength(10000) result?: string;
}
