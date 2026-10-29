import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchWatchItemsDto {
  @IsOptional() @IsString() @MaxLength(300) q?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() criticality?: string;
  @IsOptional() @IsString() watchType?: string;
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsIn(['API', 'RSS', 'ATOM', 'IMPORT_MANUEL'])
  sourceType?: string;
  @IsOptional() @Type(() => Number) @IsInt() sourceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() domainId?: number;
  @IsOptional() @Type(() => Number) @IsInt() laboratoryId?: number;
  @IsOptional()
  @Transform(({ obj, value }) => {
    const rawValue = obj?.favoritesOnly ?? value;
    return rawValue === true || rawValue === 'true';
  })
  @IsBoolean()
  favoritesOnly?: boolean;
  @IsOptional() @IsIn(['GENERATED', 'NOT_GENERATED'])
  aiQualified?: 'GENERATED' | 'NOT_GENERATED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional()
  @IsIn([
    'publishedAt',
    'collectedAt',
    'relevance',
    'criticality',
    'title',
    'sourceName',
    'sourceType',
    'summary',
    'status',
  ])
  sortBy = 'publishedAt';
  @IsOptional() @IsIn(['ASC', 'DESC']) sortOrder: 'ASC' | 'DESC' = 'DESC';
}
