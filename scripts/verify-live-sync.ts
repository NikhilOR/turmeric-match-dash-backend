import { NestFactory } from '@nestjs/core';
import { PartyType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { GoogleSheetsSyncService } from '../src/modules/google-sheets/google-sheets-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const sync = app.get(GoogleSheetsSyncService);
    const prisma = app.get(PrismaService);

    await sync.syncSheets();

    const pending = await prisma.comparisonMatch.count({
      where: { status: 'PENDING' as never },
    });
    const approved = await prisma.comparisonMatch.count({
      where: { status: 'APPROVED' as never },
    });
    const top = await prisma.comparisonMatch.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });
    const dbCounts = {
      sourceSuppliers: await prisma.sourceSupplier.count(),
      sourceBuyers: await prisma.sourceBuyer.count(),
      sourceExporters: await prisma.sourceExporter.count(),
      masterSuppliers: await prisma.supplier.count(),
      masterBuyers: await prisma.buyer.count(),
      masterExporters: await prisma.exporter.count(),
      lockedSuppliers: await prisma.supplier.count({ where: { isLocked: true } }),
      lockedBuyers: await prisma.buyer.count({ where: { isLocked: true } }),
      lockedExporters: await prisma.exporter.count({ where: { isLocked: true } }),
      pendingByType: {
        suppliers: await prisma.comparisonMatch.count({
          where: { entityType: PartyType.SUPPLIER, status: 'PENDING' as never },
        }),
        buyers: await prisma.comparisonMatch.count({
          where: { entityType: PartyType.BUYER, status: 'PENDING' as never },
        }),
        exporters: await prisma.comparisonMatch.count({
          where: { entityType: PartyType.EXPORTER, status: 'PENDING' as never },
        }),
      },
    };

    console.log(
      JSON.stringify(
        {
          ok: true,
          dbCounts,
          pending,
          approved,
          top,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const err = error as Error & { code?: string; status?: number };
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: err.message,
          code: err.code,
          status: err.status,
          stack: err.stack,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
