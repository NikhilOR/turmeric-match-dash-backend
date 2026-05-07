import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartyType, SyncSheetType } from '@prisma/client';
import { google } from 'googleapis';
import { normalizeString } from '../../common/utils/normalization.util';
import { TradingPartyInput } from '../../common/types/trading-party.type';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleSheetsParser } from './google-sheets.parser';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly parser = new GoogleSheetsParser();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async fetchNewSourceRows(sheetType: SyncSheetType): Promise<TradingPartyInput[]> {
    const spreadsheetId = this.getSourceSpreadsheetId(sheetType);
    const range = this.getSourceRange(sheetType);

    if (!spreadsheetId) {
      this.logger.warn(`Source spreadsheet ID not configured, skipping ${sheetType} sync`);
      return [];
    }

    const parsedRows = await this.fetchAndParseRows(
      spreadsheetId,
      range,
      `source-${sheetType.toLowerCase()}`,
    );

    const syncState = await this.prisma.syncState.upsert({
      where: { sheetType },
      update: {},
      create: { sheetType },
    });

    const freshRows = parsedRows.slice(Math.max(syncState.lastProcessedRow - 1, 0));

    if (!freshRows.length) {
      return [];
    }

    await this.prisma.syncState.update({
      where: { sheetType },
      data: {
        lastProcessedRow: parsedRows.length,
        lastProcessedAt: new Date(),
        lastSourceVersion: new Date().toISOString(),
      },
    });

    return freshRows;
  }

  async fetchMasterRows(sheetType: SyncSheetType): Promise<TradingPartyInput[]> {
    const spreadsheetId = this.configService.get<string>('googleSheets.masterSpreadsheetId');
    const range = this.getMasterRange(sheetType);

    if (!spreadsheetId) {
      this.logger.warn(`Master spreadsheet ID not configured, skipping ${sheetType} sync`);
      return [];
    }

    return this.fetchAndParseRows(
      spreadsheetId,
      range,
      `master-${sheetType.toLowerCase()}`,
    );
  }

  private async fetchAndParseRows(
    spreadsheetId: string,
    range: string,
    parserKey: string,
  ): Promise<TradingPartyInput[]> {
    const sheets = this.createSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values ?? [];
    return this.parser.parseRows(parserKey, rows, this.extractSheetTitle(range));
  }

  private createSheetsClient() {
    const auth = new google.auth.JWT({
      email: this.configService.get<string>('googleSheets.serviceAccountEmail'),
      key: this.configService.get<string>('googleSheets.privateKey'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  }

  async markMasterRowApprovedAndHidden(input: {
    entityType: PartyType;
    rowNumber: number;
    sourceName: string;
    matchScore: number;
  }) {
    const spreadsheetId = this.configService.get<string>('googleSheets.masterSpreadsheetId');
    const range = this.getMasterRange(this.toSyncSheetType(input.entityType));

    if (!spreadsheetId) {
      this.logger.warn('Master spreadsheet ID not configured, skipping row hide/update');
      return { updated: false, hidden: false };
    }

    const sheetTitle = this.extractSheetTitle(range);
    const sheets = this.createSheetsClient();

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const targetSheet = spreadsheet.data.sheets?.find(
      (sheet) => sheet.properties?.title === sheetTitle,
    );

    const sheetId = targetSheet?.properties?.sheetId;
    if (sheetId === undefined) {
      this.logger.warn(`Sheet ${sheetTitle} not found in master spreadsheet`);
      return { updated: false, hidden: false };
    }

    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!1:1`,
    });

    const headerRow = headerResponse.data.values?.[0]?.map((cell) =>
      String(cell ?? '').trim().toLowerCase(),
    ) ?? [];

    const statusIndex = headerRow.findIndex((header) => header === 'status');
    const notesIndex = headerRow.findIndex((header) => header === 'notes');

    if (statusIndex >= 0 || notesIndex >= 0) {
      const updates = [];
      if (statusIndex >= 0) {
        updates.push({
          range: `${sheetTitle}!${this.columnLetter(statusIndex + 1)}${input.rowNumber}`,
          values: [['Locked']],
        });
      }

      if (notesIndex >= 0) {
        updates.push({
          range: `${sheetTitle}!${this.columnLetter(notesIndex + 1)}${input.rowNumber}`,
          values: [[`Approved from dashboard: ${input.sourceName} (${input.matchScore.toFixed(2)}%)`]],
        });
      }

      if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates,
          },
        });
      }
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: input.rowNumber - 1,
                endIndex: input.rowNumber,
              },
              properties: {
                hiddenByUser: true,
              },
              fields: 'hiddenByUser',
            },
          },
        ],
      },
    });

    return { updated: true, hidden: true };
  }

  async hideCompletedMasterRows(
    entityType: PartyType,
    rows: Array<{
      rowNumber: number;
      otherAttributes: Record<string, unknown>;
    }>,
  ) {
    if (!rows.length) {
      return { hiddenCount: 0 };
    }

    const spreadsheetId = this.configService.get<string>('googleSheets.masterSpreadsheetId');
    const range = this.getMasterRange(this.toSyncSheetType(entityType));

    if (!spreadsheetId) {
      this.logger.warn('Master spreadsheet ID not configured, skipping completed-row hiding');
      return { hiddenCount: 0 };
    }

    const completedRows = rows.filter((row) => this.isCompleted(row.otherAttributes));
    if (!completedRows.length) {
      return { hiddenCount: 0 };
    }

    const sheetTitle = this.extractSheetTitle(range);
    const sheets = this.createSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const targetSheet = spreadsheet.data.sheets?.find(
      (sheet) => sheet.properties?.title === sheetTitle,
    );

    const sheetId = targetSheet?.properties?.sheetId;
    if (sheetId === undefined) {
      this.logger.warn(`Sheet ${sheetTitle} not found in master spreadsheet`);
      return { hiddenCount: 0 };
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: completedRows.map((row) => ({
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: row.rowNumber - 1,
              endIndex: row.rowNumber,
            },
            properties: {
              hiddenByUser: true,
            },
            fields: 'hiddenByUser',
          },
        })),
      },
    });

    return { hiddenCount: completedRows.length };
  }

  private getMasterRange(sheetType: SyncSheetType) {
    switch (sheetType) {
      case SyncSheetType.SUPPLIERS:
        return this.configService.getOrThrow<string>('googleSheets.masterSuppliersRange');
      case SyncSheetType.BUYERS:
        return this.configService.getOrThrow<string>('googleSheets.masterBuyersRange');
      case SyncSheetType.EXPORTERS:
        return this.configService.getOrThrow<string>('googleSheets.masterExportersRange');
    }
  }

  private toSyncSheetType(entityType: PartyType) {
    switch (entityType) {
      case PartyType.SUPPLIER:
        return SyncSheetType.SUPPLIERS;
      case PartyType.BUYER:
        return SyncSheetType.BUYERS;
      case PartyType.EXPORTER:
        return SyncSheetType.EXPORTERS;
    }
  }

  private extractSheetTitle(range: string) {
    return range.split('!')[0];
  }

  private isCompleted(otherAttributes: Record<string, unknown>) {
    const status = normalizeString(
      otherAttributes['Status'] ??
        otherAttributes['status'] ??
        otherAttributes['Interest level'] ??
        otherAttributes['interest level'],
    );

    return status === 'completed';
  }

  private columnLetter(index: number) {
    let current = index;
    let label = '';

    while (current > 0) {
      const remainder = (current - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      current = Math.floor((current - 1) / 26);
    }

    return label;
  }

  private getSourceSpreadsheetId(sheetType: SyncSheetType) {
    switch (sheetType) {
      case SyncSheetType.SUPPLIERS:
        return this.configService.get<string>('googleSheets.sourceSuppliersSpreadsheetId');
      case SyncSheetType.BUYERS:
        return this.configService.get<string>('googleSheets.sourceBuyersSpreadsheetId');
      case SyncSheetType.EXPORTERS:
        return this.configService.get<string>('googleSheets.sourceExportersSpreadsheetId');
    }
  }

  private getSourceRange(sheetType: SyncSheetType) {
    switch (sheetType) {
      case SyncSheetType.SUPPLIERS:
        return this.configService.getOrThrow<string>('googleSheets.sourceSuppliersRange');
      case SyncSheetType.BUYERS:
        return this.configService.getOrThrow<string>('googleSheets.sourceBuyersRange');
      case SyncSheetType.EXPORTERS:
        return this.configService.getOrThrow<string>('googleSheets.sourceExportersRange');
    }
  }
}
