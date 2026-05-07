import { PartyType, Prisma } from '@prisma/client';

export interface MatchCandidate {
  id: string;
  name: string;
  price: number;
  quality: number;
  quantity: number;
  location: string;
  materialType: string | null;
  otherAttributes: Prisma.JsonValue | null;
}

export interface MatchResultInput {
  entityType: PartyType;
  sourceEntityType: PartyType;
  sourceRecordId: string;
  masterRecordId: string;
  sourceName: string;
  masterName: string;
  matchScore: number;
  matchedFields: string[];
  unmatchedFields: string[];
  scoreBreakdown: Record<string, number>;
}

export interface ComparableSheetRecord extends MatchCandidate {
  sheetName: string | null;
  sheetRowNumber: number | null;
  isLocked?: boolean;
  lockedAt?: Date | null;
  hiddenAt?: Date | null;
  lockedByMatchId?: string | null;
}
