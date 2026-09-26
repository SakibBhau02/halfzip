-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advancePaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codCollected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codCollectedAt" TIMESTAMP(3),
ADD COLUMN     "courierService" TEXT,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "lastPrintedAt" TIMESTAMP(3),
ADD COLUMN     "printCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipLandmark" TEXT,
ADD COLUMN     "shipThana" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'website',
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "actor" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_orderId_createdAt_idx" ON "AuditLog"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
