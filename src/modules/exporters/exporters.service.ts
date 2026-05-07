import { Exporter } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { TradingPartyInput } from '../../common/types/trading-party.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(inputs: TradingPartyInput[]): Promise<Exporter[]> {
    const results: Exporter[] = [];

    for (const input of inputs) {
      const exporter = await this.prisma.exporter.upsert({
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

      results.push(exporter);
    }

    return results;
  }

  findAll() {
    return this.prisma.exporter.findMany();
  }
}
