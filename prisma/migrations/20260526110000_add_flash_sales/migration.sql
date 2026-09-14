CREATE TYPE "FlashSaleReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

CREATE TABLE "flash_sales" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flash_sale_items" (
  "id" TEXT NOT NULL,
  "flashSaleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variationId" TEXT,
  "salePrice" DECIMAL(10,2) NOT NULL,
  "stockLimit" INTEGER NOT NULL,
  "perUserLimit" INTEGER NOT NULL DEFAULT 1,
  "soldCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flash_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flash_sale_reservations" (
  "id" TEXT NOT NULL,
  "flashSaleItemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "FlashSaleReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "flash_sale_reservations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_items" ADD COLUMN "flashSaleItemId" TEXT;

CREATE INDEX "flash_sales_isActive_startsAt_endsAt_idx" ON "flash_sales"("isActive", "startsAt", "endsAt");
CREATE INDEX "flash_sale_items_flashSaleId_idx" ON "flash_sale_items"("flashSaleId");
CREATE INDEX "flash_sale_items_productId_idx" ON "flash_sale_items"("productId");
CREATE INDEX "flash_sale_items_variationId_idx" ON "flash_sale_items"("variationId");
CREATE UNIQUE INDEX "flash_sale_reservations_orderId_key" ON "flash_sale_reservations"("orderId");
CREATE INDEX "flash_sale_reservations_flashSaleItemId_status_expiresAt_idx" ON "flash_sale_reservations"("flashSaleItemId", "status", "expiresAt");
CREATE INDEX "flash_sale_reservations_userId_status_idx" ON "flash_sale_reservations"("userId", "status");
CREATE INDEX "order_items_flashSaleItemId_idx" ON "order_items"("flashSaleItemId");

ALTER TABLE "flash_sale_items"
ADD CONSTRAINT "flash_sale_items_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flash_sale_items"
ADD CONSTRAINT "flash_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flash_sale_items"
ADD CONSTRAINT "flash_sale_items_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flash_sale_reservations"
ADD CONSTRAINT "flash_sale_reservations_flashSaleItemId_fkey" FOREIGN KEY ("flashSaleItemId") REFERENCES "flash_sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flash_sale_reservations"
ADD CONSTRAINT "flash_sale_reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flash_sale_reservations"
ADD CONSTRAINT "flash_sale_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_flashSaleItemId_fkey" FOREIGN KEY ("flashSaleItemId") REFERENCES "flash_sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
