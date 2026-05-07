-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('SUPPLIER', 'BUYER', 'EXPORTER');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('BUYER', 'EXPORTER');

-- CreateEnum
CREATE TYPE "SyncSheetType" AS ENUM ('SUPPLIERS', 'BUYERS', 'EXPORTERS');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "externalRowId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "materialType" TEXT,
    "otherAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "externalRowId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "materialType" TEXT,
    "otherAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exporter" (
    "id" TEXT NOT NULL,
    "externalRowId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "materialType" TEXT,
    "otherAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "matchedId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "matchedFields" JSONB NOT NULL,
    "unmatchedFields" JSONB NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "sheetType" "SyncSheetType" NOT NULL,
    "lastProcessedRow" INTEGER NOT NULL DEFAULT 1,
    "lastProcessedAt" TIMESTAMP(3),
    "lastSourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_externalRowId_key" ON "Supplier"("externalRowId");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_location_idx" ON "Supplier"("location");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_externalRowId_key" ON "Buyer"("externalRowId");

-- CreateIndex
CREATE INDEX "Buyer_name_idx" ON "Buyer"("name");

-- CreateIndex
CREATE INDEX "Buyer_location_idx" ON "Buyer"("location");

-- CreateIndex
CREATE UNIQUE INDEX "Exporter_externalRowId_key" ON "Exporter"("externalRowId");

-- CreateIndex
CREATE INDEX "Exporter_name_idx" ON "Exporter"("name");

-- CreateIndex
CREATE INDEX "Exporter_location_idx" ON "Exporter"("location");

-- CreateIndex
CREATE INDEX "Match_supplierId_matchType_matchScore_idx" ON "Match"("supplierId", "matchType", "matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "Match_supplierId_matchedId_matchType_key" ON "Match"("supplierId", "matchedId", "matchType");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_sheetType_key" ON "SyncState"("sheetType");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
