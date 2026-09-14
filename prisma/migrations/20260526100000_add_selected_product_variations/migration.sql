ALTER TABLE "cart_items"
ADD COLUMN "variationId" TEXT;

ALTER TABLE "order_items"
ADD COLUMN "variationId" TEXT;

DROP INDEX "cart_items_cartId_productId_key";

CREATE UNIQUE INDEX "cart_items_cartId_productId_variationId_key"
ON "cart_items"("cartId", "productId", "variationId");

CREATE INDEX "cart_items_variationId_idx" ON "cart_items"("variationId");
CREATE INDEX "order_items_variationId_idx" ON "order_items"("variationId");

ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_variationId_fkey"
FOREIGN KEY ("variationId") REFERENCES "product_variations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_variationId_fkey"
FOREIGN KEY ("variationId") REFERENCES "product_variations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
