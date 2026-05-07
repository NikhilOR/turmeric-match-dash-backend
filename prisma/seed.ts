import { PartyType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.comparisonMatch.deleteMany();
  await prisma.sourceBuyer.deleteMany();
  await prisma.sourceExporter.deleteMany();
  await prisma.sourceSupplier.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.exporter.deleteMany();
  await prisma.supplier.deleteMany();

  const masterSupplier = await prisma.supplier.create({
    data: {
      externalRowId: 'master-suppliers-2',
      name: 'Aiyra Rane',
      price: 90,
      quality: 8.5,
      quantity: 10000,
      location: 'Sindhudurg',
      materialType: 'Dry Finger',
      otherAttributes: {
        polishLevel: 'Farmer Polish, Unpolished',
        variety: 'RS/Mega',
        origin: 'Sindhudurg',
      },
    },
  });

  const sourceSupplier = await prisma.sourceSupplier.create({
    data: {
      externalRowId: 'source-suppliers-2',
      name: 'Aiyra Rane',
      price: 92,
      quality: 8,
      quantity: 9500,
      location: 'Sindhudurg',
      materialType: 'Dry Finger',
      otherAttributes: {
        polishLevel: 'Farmer Polish, Unpolished',
        variety: 'RS/Mega',
        origin: 'Sindhudurg',
      },
    },
  });

  const masterBuyer = await prisma.buyer.create({
    data: {
      externalRowId: 'master-buyers-7',
      name: 'Value Ingredients Pvt Ltd',
      price: 143,
      quality: 3.2,
      quantity: 25000,
      location: 'Chennai',
      materialType: 'Dry Finger',
      otherAttributes: {
        industryType: 'Powder / PM',
      },
    },
  });

  const sourceBuyer = await prisma.sourceBuyer.create({
    data: {
      externalRowId: 'source-buyers-7',
      name: 'Value Ingredients Pvt Ltd',
      price: 146,
      quality: 3,
      quantity: 3000,
      location: 'Visakhapatnam',
      materialType: 'Dry Finger',
      otherAttributes: {
        industryType: 'Powder',
      },
    },
  });

  await prisma.comparisonMatch.createMany({
    data: [
      {
        entityType: PartyType.SUPPLIER,
        sourceRecordId: sourceSupplier.id,
        masterRecordId: masterSupplier.id,
        sourceName: sourceSupplier.name,
        masterName: masterSupplier.name,
        matchScore: 88.4,
        matchedFields: ['price', 'quality', 'location', 'others'],
        unmatchedFields: ['quantity'],
        scoreBreakdown: {
          price: 29.33,
          quality: 23.53,
          quantity: 19,
          location: 15,
          others: 1.54,
        },
      },
      {
        entityType: PartyType.BUYER,
        sourceRecordId: sourceBuyer.id,
        masterRecordId: masterBuyer.id,
        sourceName: sourceBuyer.name,
        masterName: masterBuyer.name,
        matchScore: 73.5,
        matchedFields: ['price', 'quality'],
        unmatchedFields: ['quantity', 'location', 'others'],
        scoreBreakdown: {
          price: 29.37,
          quality: 23.44,
          quantity: 2.4,
          location: 0,
          others: 18.29,
        },
      },
    ],
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
