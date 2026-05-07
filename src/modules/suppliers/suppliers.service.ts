import { Injectable } from '@nestjs/common';
import { Supplier } from '@prisma/client';
import { TradingPartyInput } from '../../common/types/trading-party.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(inputs: TradingPartyInput[]): Promise<Supplier[]> {
    const results: Supplier[] = [];

    for (const input of inputs) {
      const supplier = await this.prisma.supplier.upsert({
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

      results.push(supplier);
    }

    return results;
  }

  findAll() {
    return this.prisma.supplier.findMany();
  }
}
