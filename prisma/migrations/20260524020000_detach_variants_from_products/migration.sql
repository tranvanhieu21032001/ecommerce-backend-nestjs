DROP INDEX IF EXISTS "variants_productId_idx";

ALTER TABLE "variants" DROP CONSTRAINT IF EXISTS "variants_productId_fkey";

ALTER TABLE "variants" DROP COLUMN IF EXISTS "productId";

ALTER TABLE "variants" ALTER COLUMN "price" SET DEFAULT 0;
