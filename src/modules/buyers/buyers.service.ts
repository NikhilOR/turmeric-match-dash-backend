import { Buyer } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { TradingPartyInput } from '../../common/types/trading-party.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BuyersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(inputs: TradingPartyInput[]): Promise<Buyer[]> {
    const results: Buyer[] = [];

    for (const input of inputs) {
      const buyer = await this.prisma.buyer.upsert({
        where: { externalRowId: input.externalRowId },
        update: {
          name: input.name,
          price: input.price,
          quality: input.quality,
          quantity: input.quantity,
          location: input.location,
          materialType: input.materialType,
          otherAttributes: input.otherAttributes,
          sourceUpdatedAt: input.sourceUpdatedAt,
        },
        create: input,
      });

      results.push(buyer);
    }

    return results;
  }

  findAll() {
    return this.prisma.buyer.findMany();
  }
}
