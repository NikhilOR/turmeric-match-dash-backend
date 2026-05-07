import { Prisma } from '@prisma/client';
import { TradingPartyInput } from '../../common/types/trading-party.type';
import { toNumber } from '../../common/utils/normalization.util';

type SheetRow = string[];

const INTERNAL_ATTRIBUTE_KEYS = {
  polish: '__match_polish',
  grade: '__match_grade',
  origin: '__match_origin',
} as const;

export class GoogleSheetsParser {
  parseRows(sheetKey: string, rows: SheetRow[], sheetName?: string): TradingPartyInput[] {
    if (rows.length <= 1) {
      return [];
    }

    const header = rows[0].map((value) => String(value ?? '').trim());
    const dataRows = rows.slice(1);

    return dataRows
      .map((row, index) => this.mapRow(sheetKey, sheetName ?? sheetKey, header, row, index + 2))
      .filter((row): row is TradingPartyInput => Boolean(row));
  }

  private mapRow(
    sheetKey: string,
    sheetName: string,
    header: string[],
    row: SheetRow,
    rowNumber: number,
  ): TradingPartyInput | null {
    if (this.isEmptyRow(row)) {
      return null;
    }

    const valueByHeader = new Map<string, string>();
    header.forEach((key, index) =>
      valueByHeader.set(this.normalizeHeader(key), String(row[index] ?? '').trim()),
    );

    const isSupplierRow = sheetKey.includes('suppliers');
    const name = this.read(valueByHeader, ['suppliername', 'buyername', 'name']);
    const price = toNumber(
      this.read(valueByHeader, [
        'pricekg',
        'maxpricekg',
        'valueinrperkg',
        'effectivesupplierprice',
      ]),
    );
    const quality = toNumber(this.read(valueByHeader, ['curcumin', 'mincurcumin', 'quality']), 0);
    const quantity = toNumber(
      this.read(valueByHeader, ['quantitykg', 'quantityneededkg', 'buyqtyneededkg']),
      0,
    );
    const location = isSupplierRow
      ? this.read(valueByHeader, ['loadinglocation', 'location']) || 'Unknown'
      : this.read(valueByHeader, [
          'preferredorigin',
          'deliverylocation',
          'consignmentdestination',
          'portofdelivery',
          'location',
        ]) || 'Unknown';
    const materialType = this.read(valueByHeader, ['materialtype']);
    const polishLevel = this.read(valueByHeader, ['polishlevel', 'polish']);
    const acceptedGrade = this.read(valueByHeader, ['acceptedgrade', 'grade']);
    const preferredOrigin = isSupplierRow
      ? this.read(valueByHeader, ['origin', 'variety'])
      : this.read(valueByHeader, ['preferredorigin', 'origin']);
    const updatedAtRaw = this.read(valueByHeader, ['lastupdated', 'date']);

    if (!this.hasMeaningfulData({ name, price, quality, quantity, location, materialType })) {
      return null;
    }

    const otherAttributes: Record<string, unknown> = {};
    header.forEach((key, index) => {
      if (!key) {
        return;
      }

      otherAttributes[key] = row[index] ?? null;
    });
    otherAttributes[INTERNAL_ATTRIBUTE_KEYS.polish] = polishLevel || null;
    otherAttributes[INTERNAL_ATTRIBUTE_KEYS.grade] = acceptedGrade || null;
    otherAttributes[INTERNAL_ATTRIBUTE_KEYS.origin] = preferredOrigin || null;

    return {
      externalRowId: `${sheetKey.toLowerCase()}-${rowNumber}`,
      sourceUpdatedAt: this.parseDate(updatedAtRaw),
      sheetName,
      sheetRowNumber: rowNumber,
      name,
      price,
      quality,
      quantity,
      location,
      materialType,
      otherAttributes: otherAttributes as Prisma.InputJsonValue,
    };
  }

  private isEmptyRow(row: SheetRow): boolean {
    return row.every((value) => String(value ?? '').trim() === '');
  }

  private hasMeaningfulData(input: {
    name: string;
    price: number;
    quality: number;
    quantity: number;
    location: string;
    materialType: string;
  }): boolean {
    return Boolean(
      input.name ||
        input.materialType ||
        (input.location && input.location !== 'Unknown') ||
        input.price > 0 ||
        input.quality > 0 ||
        input.quantity > 0,
    );
  }

  private read(values: Map<string, string>, keys: string[]) {
    for (const key of keys) {
      const value = values.get(this.normalizeHeader(key));
      if (value !== undefined && value !== '') {
        return value;
      }
    }

    return '';
  }

  private normalizeHeader(value: string) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private parseDate(value: string): Date | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return undefined;
    }

    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (!match) {
      return undefined;
    }

    const [, dayRaw, monthRaw, yearRaw] = match;
    const day = Number(dayRaw);
    const month = Number(monthRaw) - 1;
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    const parsed = new Date(Date.UTC(year, month, day));

    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
