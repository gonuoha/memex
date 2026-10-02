-- AlterTable
ALTER TABLE "ItemType" ALTER COLUMN "kind" SET DEFAULT 'markdown';


-- Backfill kind and slug for pre-existing custom types
UPDATE "ItemType" SET "kind" = 'markdown' WHERE "isSystem" = false AND "kind" NOT IN ('code', 'markdown', 'link');
UPDATE "ItemType" SET "slug" = left(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), 40)
WHERE "isSystem" = false AND "slug" IS NULL;
