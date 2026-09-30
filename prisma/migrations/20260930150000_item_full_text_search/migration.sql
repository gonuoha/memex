-- EnableExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("description", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(left("content", 20000), '')), 'C') ||
  setweight(to_tsvector('simple', coalesce("url", '') || ' ' || coalesce("fileName", '')), 'C')
) STORED;

-- CreateIndex
CREATE INDEX "Item_searchVector_idx" ON "Item" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "Item_title_trgm_idx" ON "Item" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Collection_name_trgm_idx" ON "Collection" USING GIN ("name" gin_trgm_ops);
