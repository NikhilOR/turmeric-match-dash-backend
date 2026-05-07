-- CreateEnum
CREATE TYPE "ComparisonMatchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "SourceSupplier"
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetRowNumber" INTEGER;

-- AlterTable
ALTER TABLE "SourceBuyer"
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetRowNumber" INTEGER;

-- AlterTable
ALTER TABLE "SourceExporter"
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetRowNumber" INTEGER;

-- AlterTable
ALTER TABLE "Supplier"
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetRowNumber" INTEGER,
ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "lockedByMatchId" TEXT;

-- AlterTable
ALTER TABLE "Buyer"
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetRowNumber" INTEGER,
ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "lockedByMatchId" TEXT;

-- AlterTable
ALTER TABLE "Exporter"
ADD COLUMN "sheetName" TEXT,
ADD COLUMN "sheetRowNumber" INTEGER,
ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "lockedByMatchId" TEXT;

-- AlterTable
ALTER TABLE "ComparisonMatch"
ADD COLUMN "status" "ComparisonMatchStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Deduplicate existing source-to-master comparison rows before tightening uniqueness
WITH ranked_matches AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "entityType", "sourceRecordId"
      ORDER BY "matchScore" DESC, "updatedAt" DESC, "createdAt" DESC
    ) AS row_num
  FROM "ComparisonMatch"
)
DELETE FROM "ComparisonMatch"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_matches
  WHERE row_num > 1
);

-- DropIndex
DROP INDEX "ComparisonMatch_entityType_sourceRecordId_masterRecordId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonMatch_entityType_sourceRecordId_key" ON "ComparisonMatch"("entityType", "sourceRecordId");
