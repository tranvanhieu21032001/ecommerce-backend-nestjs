-- AlterTable
ALTER TABLE "variants" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';
