import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { AiClassificationDto } from './ai-classification.dto';

export class ReviewAiAnalysisDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) relevanceScore?: number;
  @IsOptional() @IsString() @MaxLength(2000) relevanceReason?: string;
  @IsOptional() @IsString() @MaxLength(6000) summary?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(500, { each: true }) potentialImpacts?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(500, { each: true }) recommendedChecks?: string[];
  @IsOptional() @ValidateNested() @Type(() => AiClassificationDto) classification?: AiClassificationDto;
}
