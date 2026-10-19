import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const WATCH_TYPE_VALUES = ['SCIENTIFIQUE', 'REGLEMENTAIRE', 'ACCREDITATION', 'NORMATIF', 'ENVIRONNEMENT', 'AUTRE'] as const;

export class AiClassificationDto {
  @IsOptional() @IsIn(WATCH_TYPE_VALUES) watchType?: typeof WATCH_TYPE_VALUES[number] | null;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true }) themes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true }) domains?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true }) keywords?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsInt({ each: true }) @Min(1, { each: true }) @Max(10, { each: true }) keywordWeights?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true }) laboratories?: string[];
  @IsOptional() @IsString() @MaxLength(2000) rationale?: string;
}
