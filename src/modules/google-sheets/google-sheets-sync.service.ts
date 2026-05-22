import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  PartyType,
  Prisma,
  SyncSheetType,
} from '@prisma/client';
import { MatchesService } from '../matches/matches.service';
import { MatchingService } from '../matching-engine/matching.service';
import { GoogleSheetsService } from './google-sheets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingPartyInput } from '../../common/types/trading-party.type';
import { ComparableSheetRecord } from '../matching-engine/interfaces/matching.interface';
import { normalizeString } from '../../common/utils/normalization.util';

type ComparableRecord = {
  id: string;
  name: string;
  price: number;
  quality: number;
  quantity: number;
  location: string;
  materialType: string | null;
  otherAttributes: Prisma.JsonValue;
  sheetName?: string | null;
  sheetRowNumber?: number | null;
  isLocked?: boolean;
  lockedAt?: Date | null;
  hiddenAt?: Date | null;
  lockedByMatchId?: string | null;
};

type ComparisonConfig = {
  sourceSheetType: SyncSheetType;
  sourceEntityType: PartyType;
  masterSheetType: SyncSheetType;
  masterEntityType: PartyType;
};

const COMPARISON_CONFIGS: ComparisonConfig[] = [
  {
    sourceSheetType: SyncSheetType.SUPPLIERS,
    sourceEntityType: PartyType.SUPPLIER,
    masterSheetType: SyncSheetType.BUYERS,
    masterEntityType: PartyType.BUYER,
  },
  {
    sourceSheetType: SyncSheetType.SUPPLIERS,
    sourceEntityType: PartyType.SUPPLIER,
    masterSheetType: SyncSheetType.EXPORTERS,
    masterEntityType: PartyType.EXPORTER,
  },
];

@Injectable()
export class GoogleSheetsSyncService implements OnModuleInit {
  private readonly logger = new Logger(GoogleSheetsSyncService.name);
  private isSyncInProgress = false;

  constructor(
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly matchingService: MatchingService,
    private readonly matchesService: MatchesService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.resetMatchingState();
    await this.removeLegacyFallbackRows();
    await this.matchesService.clearAllPendingMatches();
    await this.syncSheets();
  }

  @Cron('*/15 * * * * *')
  async syncSheets() {
    if (this.isSyncInProgress) {
      this.logger.warn('Skipping sync because a previous run is still active');
      return;
    }

    this.isSyncInProgress = true;

    try {
      for (const config of COMPARISON_CONFIGS) {
        await this.syncComparisonSet(config);
      }
    } catch (error) {
      this.logger.error(
        'Google Sheets sync failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isSyncInProgress = false;
    }
  }

  private async syncComparisonSet(config: ComparisonConfig) {
    const [sourceRows, masterRows] = await Promise.all([
      this.googleSheetsService.fetchNewSourceRows(config.sourceSheetType),
      this.googleSheetsService.fetchMasterRows(config.masterSheetType),
    ]);

    if (sourceRows.length || masterRows.length) {
      await Promise.all([
        sourceRows.length
          ? this.upsertSourceRecords(config.sourceEntityType, sourceRows)
          : Promise.resolve([]),
        masterRows.length
          ? this.upsertMasterRecords(config.masterEntityType, masterRows)
          : Promise.resolve([]),
      ]);
    }

    await this.syncCompletedMasterRows(config.masterEntityType);

    const [sourceRecords, masterRecords] = await Promise.all([
      this.getAllSourceRecords(config.sourceEntityType),
      this.getAllMasterRecords(config.masterEntityType),
    ]);

    if (!sourceRecords.length || !masterRecords.length) {
      return;
    }

    const availableMasterCandidates = masterRecords
      .filter((record) => !record.isLocked && !this.isCompletedRecord(record))
      .map((record) => this.toCandidate(record));

    for (const sourceRecord of sourceRecords) {
      const hasApprovedMatch = await this.matchesService.hasApprovedMatch(
        config.masterEntityType,
        config.sourceEntityType,
        sourceRecord.id,
      );

      if (hasApprovedMatch) {
        continue;
      }

      const sourceCandidate = this.toCandidate(sourceRecord);
      const matches = this.matchingService.sortMatches(
        this.matchingService.generateMatches(
          sourceCandidate,
          availableMasterCandidates,
          config.masterEntityType,
          config.sourceEntityType,
        ),
      );

      const bestMatch = matches[0];
      const minScore = this.configService.get<number>('app.matchMinScore', 60);

      if (!bestMatch || bestMatch.matchScore < minScore) {
        await this.matchesService.clearPendingMatch(
          config.masterEntityType,
          config.sourceEntityType,
          sourceRecord.id,
        );
        continue;
      }

      await this.matchesService.upsertBestMatch(bestMatch);
    }
  }

  private async upsertSourceRecords(
    entityType: PartyType,
    inputs: TradingPartyInput[],
  ) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return this.upsertSourceSuppliers(inputs);
      case PartyType.BUYER:
        return this.upsertSourceBuyers(inputs);
      case PartyType.EXPORTER:
        return this.upsertSourceExporters(inputs);
    }
  }

  private async upsertMasterRecords(
    entityType: PartyType,
    inputs: TradingPartyInput[],
  ) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return this.upsertMasterSuppliers(inputs);
      case PartyType.BUYER:
        return this.upsertMasterBuyers(inputs);
      case PartyType.EXPORTER:
        return this.upsertMasterExporters(inputs);
    }
  }

  private mapTradingParty(input: TradingPartyInput) {
    return {
      name: input.name,
      price: input.price,
      quality: input.quality,
      quantity: input.quantity,
      location: input.location,
      materialType: input.materialType,
      sheetName: input.sheetName,
      sheetRowNumber: input.sheetRowNumber,
      otherAttributes: input.otherAttributes,
      sourceUpdatedAt: input.sourceUpdatedAt,
    };
  }

  private async upsertSourceSuppliers(inputs: TradingPartyInput[]) {
    const records: ComparableRecord[] = [];

    for (const input of inputs) {
      records.push(
        await this.prisma.sourceSupplier.upsert({
          where: { externalRowId: input.externalRowId },
          update: this.mapTradingParty(input),
          create: {
            externalRowId: input.externalRowId,
            ...this.mapTradingParty(input),
          },
        }),
      );
    }

    return records;
  }

  private async upsertSourceBuyers(inputs: TradingPartyInput[]) {
    const records: ComparableRecord[] = [];

    for (const input of inputs) {
      records.push(
        await this.prisma.sourceBuyer.upsert({
          where: { externalRowId: input.externalRowId },
          update: this.mapTradingParty(input),
          create: {
            externalRowId: input.externalRowId,
            ...this.mapTradingParty(input),
          },
        }),
      );
    }

    return records;
  }

  private async upsertSourceExporters(inputs: TradingPartyInput[]) {
    const records: ComparableRecord[] = [];

    for (const input of inputs) {
      records.push(
        await this.prisma.sourceExporter.upsert({
          where: { externalRowId: input.externalRowId },
          update: this.mapTradingParty(input),
          create: {
            externalRowId: input.externalRowId,
            ...this.mapTradingParty(input),
          },
        }),
      );
    }

    return records;
  }

  private async upsertMasterSuppliers(inputs: TradingPartyInput[]) {
    const records: ComparableRecord[] = [];

    for (const input of inputs) {
      records.push(
        await this.prisma.supplier.upsert({
          where: { externalRowId: input.externalRowId },
          update: this.mapTradingParty(input),
          create: {
            externalRowId: input.externalRowId,
            ...this.mapTradingParty(input),
          },
        }),
      );
    }

    return records;
  }

  private async upsertMasterBuyers(inputs: TradingPartyInput[]) {
    const records: ComparableRecord[] = [];

    for (const input of inputs) {
      records.push(
        await this.prisma.buyer.upsert({
          where: { externalRowId: input.externalRowId },
          update: this.mapTradingParty(input),
          create: {
            externalRowId: input.externalRowId,
            ...this.mapTradingParty(input),
          },
        }),
      );
    }

    return records;
  }

  private async upsertMasterExporters(inputs: TradingPartyInput[]) {
    const records: ComparableRecord[] = [];

    for (const input of inputs) {
      records.push(
        await this.prisma.exporter.upsert({
          where: { externalRowId: input.externalRowId },
          update: this.mapTradingParty(input),
          create: {
            externalRowId: input.externalRowId,
            ...this.mapTradingParty(input),
          },
        }),
      );
    }

    return records;
  }

  private async getAllSourceRecords(entityType: PartyType) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return this.prisma.sourceSupplier.findMany();
      case PartyType.BUYER:
        return this.prisma.sourceBuyer.findMany();
      case PartyType.EXPORTER:
        return this.prisma.sourceExporter.findMany();
    }
  }

  private async getAllMasterRecords(entityType: PartyType) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return this.prisma.supplier.findMany();
      case PartyType.BUYER:
        return this.prisma.buyer.findMany();
      case PartyType.EXPORTER:
        return this.prisma.exporter.findMany();
    }
  }

  private async syncCompletedMasterRows(entityType: PartyType) {
    const masterRecords = await this.getAllMasterRecords(entityType);
    const completedRows = masterRecords.filter((record) => this.isCompletedRecord(record));

    if (!completedRows.length) {
      return;
    }

    for (const row of completedRows) {
      if (!row.isLocked) {
        await this.lockCompletedMasterRecord(entityType, row.id);
      }
    }

    await this.matchesService.clearPendingMatchesForMasterRecords(
      entityType,
      completedRows.map((row) => row.id),
    );

    await this.googleSheetsService.hideCompletedMasterRows(
      entityType,
      completedRows
        .filter((row) => row.sheetRowNumber)
        .map((row) => ({
          rowNumber: row.sheetRowNumber as number,
          otherAttributes: this.asObject(row.otherAttributes),
        })),
    );
  }

  private async lockCompletedMasterRecord(entityType: PartyType, id: string) {
    const data = {
      isLocked: true,
      lockedAt: new Date(),
      hiddenAt: new Date(),
      lockedByMatchId: 'completed-status',
    };

    switch (entityType) {
      case PartyType.SUPPLIER:
        return this.prisma.supplier.update({ where: { id }, data });
      case PartyType.BUYER:
        return this.prisma.buyer.update({ where: { id }, data });
      case PartyType.EXPORTER:
        return this.prisma.exporter.update({ where: { id }, data });
    }
  }

  private isCompletedRecord(record: ComparableRecord) {
    const attributes = this.asObject(record.otherAttributes);
    const status = normalizeString(
      attributes.Status ??
        attributes.status ??
        attributes['Interest level'] ??
        attributes['interest level'],
    );

    return status === 'completed';
  }

  private asObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toCandidate(record: ComparableRecord): ComparableSheetRecord {
    return {
      id: record.id,
      name: record.name,
      price: record.price,
      quality: record.quality,
      quantity: record.quantity,
      location: record.location,
      materialType: record.materialType,
      otherAttributes: record.otherAttributes,
      sheetName: record.sheetName ?? null,
      sheetRowNumber: record.sheetRowNumber ?? null,
      isLocked: record.isLocked,
      lockedAt: record.lockedAt,
      hiddenAt: record.hiddenAt,
      lockedByMatchId: record.lockedByMatchId,
    };
  }

  private async resetMatchingState() {
    await this.prisma.syncState.deleteMany();
  }

  private async removeLegacyFallbackRows() {
    const rowPrefixFilter = {
      OR: [
        { name: { startsWith: 'Row ' } },
        { name: '' },
      ],
    };

    await Promise.all([
      this.prisma.sourceSupplier.deleteMany({ where: rowPrefixFilter }),
      this.prisma.sourceBuyer.deleteMany({ where: rowPrefixFilter }),
      this.prisma.sourceExporter.deleteMany({ where: rowPrefixFilter }),
      this.prisma.supplier.deleteMany({ where: rowPrefixFilter }),
      this.prisma.buyer.deleteMany({ where: rowPrefixFilter }),
      this.prisma.exporter.deleteMany({ where: rowPrefixFilter }),
    ]);
  }
}
