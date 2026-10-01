-- CreateIndex
CREATE INDEX "Item_userId_updatedAt_id_idx" ON "Item"("userId", "updatedAt" DESC, "id" DESC);

