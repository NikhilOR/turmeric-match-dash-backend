import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComparisonMatchStatus, PartyType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const MATCH_FIELDS = ['price', 'quality', 'quantity', 'location', 'others'] as const;
export type MatchField = (typeof MATCH_FIELDS)[number];

export class GetMatchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier_id?: string;

  @ApiPropertyOptional({ enum: PartyType, description: 'Entity type for source-to-master comparison' })
  @IsOptional()
  @IsEnum(PartyType)
  match_type?: PartyType;

  @ApiPropertyOptional({ enum: PartyType, description: 'Source entity type for section filtering' })
  @IsOptional()
  @IsEnum(PartyType)
  source_entity_type?: PartyType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source_record_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_score?: number;

  @ApiPropertyOptional({ enum: MATCH_FIELDS, description: 'Matched parameter filter' })
  @IsOptional()
  @IsIn(MATCH_FIELDS)
  matched_field?: MatchField;

  @ApiPropertyOptional({ enum: ComparisonMatchStatus })
  @IsOptional()
  @IsEnum(ComparisonMatchStatus)
  status?: ComparisonMatchStatus;
}
