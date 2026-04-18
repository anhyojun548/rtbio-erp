-- AlterTable
ALTER TABLE "tenant_altibio"."Order" ADD COLUMN     "shipMethod" TEXT,
ADD COLUMN     "shipToAddress" TEXT,
ADD COLUMN     "shipToAddressDetail" TEXT,
ADD COLUMN     "shipToAddressId" TEXT,
ADD COLUMN     "shipToLabel" TEXT,
ADD COLUMN     "shipToMemo" TEXT,
ADD COLUMN     "shipToPhone" TEXT,
ADD COLUMN     "shipToPostalCode" TEXT,
ADD COLUMN     "shipToRecipient" TEXT;

-- CreateTable
CREATE TABLE "tenant_altibio"."ClientAddress" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT,
    "phone" TEXT,
    "postalCode" TEXT,
    "address" TEXT NOT NULL,
    "addressDetail" TEXT,
    "memo" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientAddress_clientId_active_idx" ON "tenant_altibio"."ClientAddress"("clientId", "active");

-- CreateIndex
CREATE INDEX "ClientAddress_clientId_isDefault_idx" ON "tenant_altibio"."ClientAddress"("clientId", "isDefault");

-- CreateIndex
CREATE INDEX "Order_shipToAddressId_idx" ON "tenant_altibio"."Order"("shipToAddressId");

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ClientAddress" ADD CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Order" ADD CONSTRAINT "Order_shipToAddressId_fkey" FOREIGN KEY ("shipToAddressId") REFERENCES "tenant_altibio"."ClientAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

