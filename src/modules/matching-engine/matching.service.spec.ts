import { PartyType } from '@prisma/client';
import { MatchingService } from './matching.service';

describe('MatchingService', () => {
  const service = new MatchingService();

  it('computes a weighted score and classifies matched fields', () => {
    const [result] = service.generateMatches(
      {
        id: 'supplier-1',
        name: 'Supplier A',
        price: 100,
        quality: 8,
        quantity: 1000,
        location: 'Erode',
        materialType: 'Dry Finger',
        otherAttributes: {
          polishLevel: 'Unpolished',
        },
      },
      [
        {
          id: 'buyer-1',
          name: 'Buyer A',
          price: 95,
          quality: 8,
          quantity: 900,
          location: 'Erode',
          materialType: 'Dry Finger',
          otherAttributes: {
            polishLevel: 'Unpolished',
          },
        },
      ],
      PartyType.BUYER,
      PartyType.SUPPLIER,
    );

    expect(result.entityType).toBe(PartyType.BUYER);
    expect(result.sourceEntityType).toBe(PartyType.SUPPLIER);
    expect(result.matchScore).toBeGreaterThan(80);
    expect(result.matchedFields).toContain('price');
    expect(result.matchedFields).toContain('location');
    expect(result.unmatchedFields).not.toContain('location');
  });
});
