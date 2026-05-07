import { Injectable } from '@nestjs/common';
import { PartyType, Prisma } from '@prisma/client';
import { normalizeString } from '../../common/utils/normalization.util';
import { MatchCandidate, MatchResultInput } from './interfaces/matching.interface';
import { MatchField } from '../matches/dto/get-matches-query.dto';

const FIELD_WEIGHTS = {
  price: 30,
  quality: 25,
  quantity: 20,
  location: 15,
  others: 10,
} as const;

const SHARED_ATTRIBUTE_KEYS = ['__match_polish', '__match_grade', '__match_origin'] as const;

@Injectable()
export class MatchingService {
  generateMatches(
    sourceRecord: MatchCandidate,
    candidates: MatchCandidate[],
    entityType: PartyType,
    sourceEntityType: PartyType,
  ): MatchResultInput[] {
    return candidates.map((candidate) =>
      this.calculateMatch(sourceRecord, candidate, entityType, sourceEntityType),
    );
  }

  sortMatches(matches: MatchResultInput[], matchedField?: MatchField) {
    return [...matches].sort((left, right) => this.compareMatches(left, right, matchedField));
  }

  private calculateMatch(
    sourceRecord: MatchCandidate,
    candidate: MatchCandidate,
    entityType: PartyType,
    sourceEntityType: PartyType,
  ): MatchResultInput {
    const priceScore =
      this.scoreNumberSimilarity(sourceRecord.price, candidate.price) *
      FIELD_WEIGHTS.price;
    const qualityScore =
      this.scoreNumberSimilarity(sourceRecord.quality, candidate.quality) *
      FIELD_WEIGHTS.quality;
    const quantityScore =
      this.scoreNumberSimilarity(sourceRecord.quantity, candidate.quantity) *
      FIELD_WEIGHTS.quantity;
    const locationScore =
      this.scoreStringSimilarity(sourceRecord.location, candidate.location) *
      FIELD_WEIGHTS.location;
    const othersScore =
      this.scoreOtherAttributes(sourceRecord, candidate) * FIELD_WEIGHTS.others;

    const breakdown = {
      price: Number(priceScore.toFixed(2)),
      quality: Number(qualityScore.toFixed(2)),
      quantity: Number(quantityScore.toFixed(2)),
      location: Number(locationScore.toFixed(2)),
      others: Number(othersScore.toFixed(2)),
    };

    const matchedFields: string[] = [];
    const unmatchedFields: string[] = [];

    for (const [field, score] of Object.entries(breakdown)) {
      if (score > 0.6 * FIELD_WEIGHTS[field as keyof typeof FIELD_WEIGHTS]) {
        matchedFields.push(field);
      } else {
        unmatchedFields.push(field);
      }
    }

    return {
      entityType,
      sourceEntityType,
      sourceRecordId: sourceRecord.id,
      masterRecordId: candidate.id,
      sourceName: sourceRecord.name,
      masterName: candidate.name,
      matchScore: Number(
        (
          breakdown.price +
          breakdown.quality +
          breakdown.quantity +
          breakdown.location +
          breakdown.others
        ).toFixed(2),
      ),
      matchedFields,
      unmatchedFields,
      scoreBreakdown: breakdown,
    };
  }

  private scoreNumberSimilarity(left: number, right: number): number {
    const maxValue = Math.max(Math.abs(left), Math.abs(right), 1);
    const delta = Math.abs(left - right);
    return Math.max(0, 1 - delta / maxValue);
  }

  private scoreStringSimilarity(left: string, right: string): number {
    const normalizedLeft = normalizeString(left);
    const normalizedRight = normalizeString(right);

    if (!normalizedLeft || !normalizedRight) {
      return 0;
    }

    if (normalizedLeft === normalizedRight) {
      return 1;
    }

    if (
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft)
    ) {
      return 0.7;
    }

    return 0;
  }

  private scoreOtherAttributes(
    sourceRecord: MatchCandidate,
    candidate: MatchCandidate,
  ): number {
    const sourceAttributes = this.asObject(sourceRecord.otherAttributes);
    const candidateAttributes = this.asObject(candidate.otherAttributes);
    let score = 0;

    if (
      sourceRecord.materialType &&
      candidate.materialType &&
      normalizeString(sourceRecord.materialType) ===
        normalizeString(candidate.materialType)
    ) {
      score += 0.5;
    }

    let totalComparable = 0;
    let matchedComparable = 0;

    for (const key of SHARED_ATTRIBUTE_KEYS) {
      const leftValue = this.readAttribute(sourceAttributes[key]);
      const rightValue = this.readAttribute(candidateAttributes[key]);

      if (!leftValue || !rightValue) {
        continue;
      }

      totalComparable += 1;
      if (this.scoreStringSimilarity(leftValue, rightValue) > 0) {
        matchedComparable += 1;
      }
    }

    if (totalComparable > 0) {
      score += 0.5 * (matchedComparable / totalComparable);
    }

    return Math.min(1, score);
  }

  private asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readAttribute(value: unknown) {
    return String(value ?? '').trim();
  }

  private compareMatches(
    left: MatchResultInput,
    right: MatchResultInput,
    matchedField?: MatchField,
  ) {
    if (matchedField) {
      const fieldDelta = right.scoreBreakdown[matchedField] - left.scoreBreakdown[matchedField];
      if (fieldDelta !== 0) {
        return fieldDelta;
      }
    }

    return right.matchScore - left.matchScore;
  }
}
