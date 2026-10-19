import { IsBoolean, IsOptional } from 'class-validator';
export class GenerateAiAnalysisDto {
  @IsOptional() @IsBoolean() force?: boolean;
}
