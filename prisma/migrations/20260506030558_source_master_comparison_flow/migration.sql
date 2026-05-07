-- CreateTable
CREATE TABLE "SourceSupplier" (
    "id" TEXT NOT NULL,
    "externalRowId" TEXT NOT NULL,
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

    CONSTRAINT "SourceSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceBuyer" (
    "id" TEXT NOT NULL,
    "externalRowId" TEXT NOT NULL,
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

    CONSTRAINT "SourceBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceExporter" (
    "id" TEXT NOT NULL,
    "externalRowId" TEXT NOT NULL,
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

    CONSTRAINT "SourceExporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonMatch" (
    "id" TEXT NOT NULL,
    "entityType" "PartyType" NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "masterRecordId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "masterName" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "matchedFields" JSONB NOT NULL,
    "unmatchedFields" JSONB NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceSupplier_externalRowId_key" ON "SourceSupplier"("externalRowId");

-- CreateIndex
CREATE INDEX "SourceSupplier_name_idx" ON "SourceSupplier"("name");

-- CreateIndex
CREATE INDEX "SourceSupplier_location_idx" ON "SourceSupplier"("location");

-- CreateIndex
CREATE UNIQUE INDEX "SourceBuyer_externalRowId_key" ON "SourceBuyer"("externalRowId");

-- CreateIndex
CREATE INDEX "SourceBuyer_name_idx" ON "SourceBuyer"("name");

-- CreateIndex
CREATE INDEX "SourceBuyer_location_idx" ON "SourceBuyer"("location");

-- CreateIndex
CREATE UNIQUE INDEX "SourceExporter_externalRowId_key" ON "SourceExporter"("externalRowId");

-- CreateIndex
CREATE INDEX "SourceExporter_name_idx" ON "SourceExporter"("name");

-- CreateIndex
CREATE INDEX "SourceExporter_location_idx" ON "SourceExporter"("location");

-- CreateIndex
CREATE INDEX "ComparisonMatch_entityType_sourceRecordId_matchScore_idx" ON "ComparisonMatch"("entityType", "sourceRecordId", "matchScore");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonMatch_entityType_sourceRecordId_masterRecordId_key" ON "ComparisonMatch"("entityType", "sourceRecordId", "masterRecordId");
