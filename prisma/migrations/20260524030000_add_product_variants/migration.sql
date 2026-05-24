CREATE TABLE "product_variations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variation_options" (
    "id" TEXT NOT NULL,
    "productVariationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variation_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_variations_productId_idx" ON "product_variations"("productId");

CREATE INDEX "product_variations_sku_idx" ON "product_variations"("sku");

CREATE INDEX "product_variations_isActive_idx" ON "product_variations"("isActive");

CREATE UNIQUE INDEX "product_variation_options_productVariationId_variantId_key" ON "product_variation_options"("productVariationId", "variantId");

CREATE INDEX "product_variation_options_productVariationId_idx" ON "product_variation_options"("productVariationId");

CREATE INDEX "product_variation_options_variantId_idx" ON "product_variation_options"("variantId");

ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_variation_options" ADD CONSTRAINT "product_variation_options_productVariationId_fkey" FOREIGN KEY ("productVariationId") REFERENCES "product_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_variation_options" ADD CONSTRAINT "product_variation_options_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
