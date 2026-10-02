-- AlterTable
ALTER TABLE "ItemType" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'note',
ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ItemType_userId_slug_key" ON "ItemType"("userId", "slug");


-- Backfill system type behaviour
UPDATE "ItemType" SET "kind" = 'code' WHERE "isSystem" = true AND lower("name") IN ('snippet', 'command');
UPDATE "ItemType" SET "kind" = 'markdown' WHERE "isSystem" = true AND lower("name") IN ('prompt', 'note');
UPDATE "ItemType" SET "kind" = 'link' WHERE "isSystem" = true AND lower("name") = 'link';
UPDATE "ItemType" SET "kind" = 'file' WHERE "isSystem" = true AND lower("name") = 'file';
UPDATE "ItemType" SET "kind" = 'image' WHERE "isSystem" = true AND lower("name") = 'image';
