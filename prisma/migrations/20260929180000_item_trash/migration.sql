-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Item_userId_deletedAt_idx" ON "Item"("userId", "deletedAt");
