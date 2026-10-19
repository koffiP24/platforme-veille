import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class QualifyWatchItemDto {
  @IsOptional()
  @IsIn([
    'SCIENTIFIQUE',
    'REGLEMENTAIRE',
    'ACCREDITATION',
    'NORMATIF',
    'ENVIRONNEMENT',
    'AUTRE',
  ])
  watchType?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  relevance: number;

  @IsArray()
  @ArrayUnique()
  topicIds: number[];

  @IsArray()
  @ArrayUnique()
  keywordIds: number[];

  @IsArray()
  @ArrayUnique()
  domainIds: number[];

  @IsArray()
  @ArrayUnique()
  laboratoryIds: number[];

  @IsOptional() @IsBoolean()
  createMissingTaxonomy?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true })
  topicLabels?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true })
  domainNames?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true })
  keywordLabels?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsInt({ each: true }) @Min(1, { each: true }) @Max(10, { each: true })
  keywordWeights?: number[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(150, { each: true })
  laboratoryNames?: string[];
}
