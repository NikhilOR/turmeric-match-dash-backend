import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ComparisonMatchStatus,
  PartyType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMatchesQueryDto, MatchField } from './dto/get-matches-query.dto';
import { MatchResultInput } from '../matching-engine/interfaces/matching.interface';
import { MatchesGateway } from './matches.gateway';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchesGateway: MatchesGateway,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  async upsertBestMatch(match: MatchResultInput) {
    const existingApproved = await this.prisma.comparisonMatch.findUnique({
      where: {
        entityType_sourceEntityType_sourceRecordId: {
          entityType: match.entityType,
          sourceEntityType: match.sourceEntityType,
          sourceRecordId: match.sourceRecordId,
        },
      },
    });

    if (existingApproved?.status === ComparisonMatchStatus.APPROVED) {
      return existingApproved;
    }

    const record = await this.prisma.comparisonMatch.upsert({
      where: {
        entityType_sourceEntityType_sourceRecordId: {
          entityType: match.entityType,
          sourceEntityType: match.sourceEntityType,
          sourceRecordId: match.sourceRecordId,
        },
      },
      update: {
        sourceEntityType: match.sourceEntityType,
        masterRecordId: match.masterRecordId,
        sourceName: match.sourceName,
        masterName: match.masterName,
        matchScore: match.matchScore,
        matchedFields: match.matchedFields,
        unmatchedFields: match.unmatchedFields,
        scoreBreakdown: match.scoreBreakdown,
        status: ComparisonMatchStatus.PENDING,
        rejectedAt: null,
      },
      create: {
        ...match,
        status: ComparisonMatchStatus.PENDING,
      },
    });

    this.matchesGateway.broadcastNewMatches([record]);
    return record;
  }

  async clearPendingMatch(
    entityType: PartyType,
    sourceEntityType: PartyType,
    sourceRecordId: string,
  ) {
    await this.prisma.comparisonMatch.deleteMany({
      where: {
        entityType,
        sourceEntityType,
        sourceRecordId,
        status: ComparisonMatchStatus.PENDING,
      },
    });
  }

  async hasApprovedMatch(
    entityType: PartyType,
    sourceEntityType: PartyType,
    sourceRecordId: string,
  ) {
    const count = await this.prisma.comparisonMatch.count({
      where: {
        entityType,
        sourceEntityType,
        sourceRecordId,
        status: ComparisonMatchStatus.APPROVED,
      },
    });

    return count > 0;
  }

  async clearAllPendingMatches() {
    await this.prisma.comparisonMatch.deleteMany({
      where: {
        status: ComparisonMatchStatus.PENDING,
      },
    });
  }

  async clearPendingMatchesForMasterRecords(
    entityType: PartyType,
    masterRecordIds: string[],
  ) {
    if (!masterRecordIds.length) {
      return;
    }

    await this.prisma.comparisonMatch.deleteMany({
      where: {
        entityType,
        masterRecordId: { in: masterRecordIds },
        status: ComparisonMatchStatus.PENDING,
      },
    });
  }

  async clearPendingMatchesForSourceRecords(
    sourceEntityType: PartyType,
    sourceRecordIds: string[],
  ) {
    if (!sourceRecordIds.length) {
      return;
    }

    await this.prisma.comparisonMatch.deleteMany({
      where: {
        sourceEntityType,
        sourceRecordId: { in: sourceRecordIds },
        status: ComparisonMatchStatus.PENDING,
      },
    });
  }

  async findAll(query: GetMatchesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const entityType = query.match_type;
    const where: Prisma.ComparisonMatchWhereInput = {
      entityType,
      sourceEntityType: query.source_entity_type,
      sourceRecordId: query.source_record_id ?? query.supplier_id,
      matchScore: query.min_score ? { gte: query.min_score } : undefined,
      status: query.status ?? ComparisonMatchStatus.PENDING,
    };

    const rawMatches = await this.prisma.comparisonMatch.findMany({
      where,
      orderBy: [{ matchScore: 'desc' }, { updatedAt: 'desc' }],
    });

    const filteredMatches = this.applyMatchedFieldFilter(rawMatches, query.matched_field);
    const total = filteredMatches.length;
    const data = filteredMatches.slice((page - 1) * limit, page * limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const match = await this.prisma.comparisonMatch.findUnique({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException(`Match ${id} not found`);
    }

    return {
      ...match,
      sourceRecord: await this.getEntity(match.sourceEntityType, match.sourceRecordId, true),
      masterRecord: await this.getEntity(match.entityType, match.masterRecordId, false),
    };
  }

  async getSummary(query?: Pick<GetMatchesQueryDto, 'match_type' | 'source_entity_type' | 'min_score' | 'matched_field'>) {
    const where: Prisma.ComparisonMatchWhereInput = {
      entityType: query?.match_type,
      sourceEntityType: query?.source_entity_type,
      matchScore: query?.min_score ? { gte: query.min_score } : undefined,
      status: ComparisonMatchStatus.PENDING,
    };

    const rawMatches = await this.prisma.comparisonMatch.findMany({
      where,
      orderBy: [{ matchScore: 'desc' }, { updatedAt: 'desc' }],
    });

    const matches = this.applyMatchedFieldFilter(rawMatches, query?.matched_field);
    const totalMatches = matches.length;
    const avgScore =
      totalMatches > 0
        ? Number(
            (matches.reduce((sum, match) => sum + match.matchScore, 0) / totalMatches).toFixed(2),
          )
        : 0;
    const topMatches = matches.slice(0, 10);
    const grouped = new Map<PartyType, { total: number; sum: number }>();

    for (const match of matches) {
      const current = grouped.get(match.sourceEntityType) ?? { total: 0, sum: 0 };
      current.total += 1;
      current.sum += match.matchScore;
      grouped.set(match.sourceEntityType, current);
    }

    return {
      totalMatches,
      avgScore,
      topMatches,
      byType: Array.from(grouped.entries()).map(([entityType, item]) => ({
        entityType,
        total: item.total,
        avgScore: Number((item.sum / item.total).toFixed(2)),
      })),
    };
  }

  async approveMatch(id: string) {
    const match = await this.prisma.comparisonMatch.findUnique({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException(`Match ${id} not found`);
    }

    if (match.status === ComparisonMatchStatus.APPROVED) {
      return this.findOne(id);
    }

    const masterRecord = await this.getMasterEntity(match.entityType, match.masterRecordId);
    if (!masterRecord) {
      throw new NotFoundException(`Master record ${match.masterRecordId} not found`);
    }

    if (masterRecord.isLocked) {
      throw new NotFoundException(`Master record ${match.masterRecordId} is already locked`);
    }

    const approvedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.updateMasterLock(tx, match.entityType, match.masterRecordId, {
        isLocked: true,
        lockedAt: approvedAt,
        lockedByMatchId: match.id,
      });

      await tx.comparisonMatch.update({
        where: { id: match.id },
        data: {
          status: ComparisonMatchStatus.APPROVED,
          approvedAt,
        },
      });
    });

    let sheetSync = { updated: false, hidden: false };
    if (masterRecord.sheetRowNumber) {
      try {
        sheetSync = await this.googleSheetsService.markMasterRowApprovedAndHidden({
          entityType: match.entityType,
          rowNumber: masterRecord.sheetRowNumber,
          sourceName: match.sourceName,
          matchScore: match.matchScore,
        });

        if (sheetSync.hidden) {
          await this.updateMasterLock(this.prisma, match.entityType, match.masterRecordId, {
            hiddenAt: new Date(),
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to update Google Sheet for approved match ${match.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return {
      ...(await this.findOne(id)),
      sheetSync,
    };
  }

  private getEntity(entityType: PartyType, id: string, source: boolean) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return source
          ? this.prisma.sourceSupplier.findUnique({ where: { id } })
          : this.prisma.supplier.findUnique({ where: { id } });
      case PartyType.BUYER:
        return source
          ? this.prisma.sourceBuyer.findUnique({ where: { id } })
          : this.prisma.buyer.findUnique({ where: { id } });
      case PartyType.EXPORTER:
        return source
          ? this.prisma.sourceExporter.findUnique({ where: { id } })
          : this.prisma.exporter.findUnique({ where: { id } });
    }
  }

  private getMasterEntity(entityType: PartyType, id: string) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return this.prisma.supplier.findUnique({ where: { id } });
      case PartyType.BUYER:
        return this.prisma.buyer.findUnique({ where: { id } });
      case PartyType.EXPORTER:
        return this.prisma.exporter.findUnique({ where: { id } });
    }
  }

  private updateMasterLock(
    client: PrismaService | Prisma.TransactionClient,
    entityType: PartyType,
    id: string,
    data: {
      isLocked?: boolean;
      lockedAt?: Date;
      lockedByMatchId?: string;
      hiddenAt?: Date;
    },
  ) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return client.supplier.update({ where: { id }, data });
      case PartyType.BUYER:
        return client.buyer.update({ where: { id }, data });
      case PartyType.EXPORTER:
        return client.exporter.update({ where: { id }, data });
    }
  }

  private applyMatchedFieldFilter<
    T extends {
      matchedFields: Prisma.JsonValue;
      scoreBreakdown: Prisma.JsonValue;
      matchScore: number;
      updatedAt: Date;
    },
  >(matches: T[], matchedField?: MatchField) {
    const filtered = matchedField
      ? matches.filter((match) => this.getMatchedFields(match.matchedFields).includes(matchedField))
      : matches;

    return filtered
      .sort((left, right) => {
        if (matchedField) {
          const rightFieldScore = this.getBreakdownScore(right.scoreBreakdown, matchedField);
          const leftFieldScore = this.getBreakdownScore(left.scoreBreakdown, matchedField);

          if (rightFieldScore !== leftFieldScore) {
            return rightFieldScore - leftFieldScore;
          }
        }

        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });
  }

  private getMatchedFields(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private getBreakdownScore(value: Prisma.JsonValue, field: MatchField): number {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 0;
    }

    const candidate = (value as Record<string, unknown>)[field];
    return typeof candidate === 'number' ? candidate : 0;
  }
}
