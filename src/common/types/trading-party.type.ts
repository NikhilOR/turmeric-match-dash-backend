import { Prisma } from '@prisma/client';

export interface TradingPartyInput {
  externalRowId: string;
  sourceUpdatedAt?: Date;
  sheetName?: string;
  sheetRowNumber?: number;
  name: string;
  price: number;
  quality: number;
  quantity: number;
  location: string;
  materialType?: string;
  otherAttributes: Prisma.InputJsonValue;
}
