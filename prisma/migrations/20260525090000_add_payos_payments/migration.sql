-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYOS';

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "payosOrderCode" BIGINT,
ADD COLUMN "paymentLinkId" TEXT,
ADD COLUMN "payosBin" TEXT,
ADD COLUMN "payosAccountNumber" TEXT,
ADD COLUMN "payosAccountName" TEXT,
ADD COLUMN "checkoutUrl" TEXT,
ADD COLUMN "qrCode" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "payments_payosOrderCode_key" ON "payments"("payosOrderCode");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentLinkId_key" ON "payments"("paymentLinkId");

-- CreateIndex
CREATE INDEX "payments_payosOrderCode_idx" ON "payments"("payosOrderCode");

-- CreateIndex
CREATE INDEX "payments_paymentLinkId_idx" ON "payments"("paymentLinkId");
