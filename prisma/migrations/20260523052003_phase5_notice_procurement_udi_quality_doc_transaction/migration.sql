-- CreateEnum
CREATE TYPE "tenant_altibio"."NoticeTarget" AS ENUM ('ALL', 'DEALER', 'HOSPITAL', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "tenant_altibio"."NoticePriority" AS ENUM ('NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "tenant_altibio"."ProcurementCategory" AS ENUM ('FABRIC', 'MATERIAL', 'PRODUCT');

-- CreateEnum
CREATE TYPE "tenant_altibio"."ProcurementStatus" AS ENUM ('PENDING', 'IN_PRODUCTION', 'SHIPPING', 'PARTIAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "tenant_altibio"."ShipmentTransport" AS ENUM ('AIR', 'SEA');

-- CreateEnum
CREATE TYPE "tenant_altibio"."UdiReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "tenant_altibio"."QualityDocKind" AS ENUM ('MANUAL', 'PROCEDURE', 'FORM');

-- CreateEnum
CREATE TYPE "tenant_altibio"."TxnKind" AS ENUM ('SALE', 'PURCHASE');

-- CreateTable
CREATE TABLE "tenant_altibio"."Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target" "tenant_altibio"."NoticeTarget" NOT NULL,
    "priority" "tenant_altibio"."NoticePriority" NOT NULL DEFAULT 'NORMAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByTeam" TEXT NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."NoticeRecipient" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."NoticeReadLog" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dontShowAgain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NoticeReadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ProcurementProject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "tenant_altibio"."ProcurementCategory" NOT NULL,
    "status" "tenant_altibio"."ProcurementStatus" NOT NULL DEFAULT 'PENDING',
    "orderDate" TIMESTAMP(3) NOT NULL,
    "plannedArrival" TIMESTAMP(3),
    "totalQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ProcurementProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ProcurementShipment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "transport" "tenant_altibio"."ShipmentTransport" NOT NULL,
    "qty" INTEGER NOT NULL,
    "departureDate" TIMESTAMP(3),
    "arrivalDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "trackingNumber" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."UdiReport" (
    "id" TEXT NOT NULL,
    "reportMonth" TEXT NOT NULL,
    "status" "tenant_altibio"."UdiReportStatus" NOT NULL DEFAULT 'DRAFT',
    "receiptNo" TEXT,
    "submittedAt" TIMESTAMP(3),
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "UdiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."UdiReportItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bizNumber" TEXT NOT NULL,
    "productId" TEXT,
    "udiCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "spec" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UdiReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."QualityDocument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "tenant_altibio"."QualityDocKind" NOT NULL,
    "category" TEXT,
    "revision" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "filePath" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "QualityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."TransactionLedger" (
    "id" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "kind" "tenant_altibio"."TxnKind" NOT NULL,
    "taxType" TEXT,
    "clientCode" TEXT,
    "clientName" TEXT,
    "productCode" TEXT,
    "productName" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "qty" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "supplyAmount" DECIMAL(15,2) NOT NULL,
    "vat" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "itemMemo" TEXT,
    "voucherNo" TEXT,
    "hasInvoice" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,
    "category" TEXT,
    "memo" TEXT,
    "importSource" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "TransactionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_createdAt_idx" ON "tenant_altibio"."Notice"("createdAt");

-- CreateIndex
CREATE INDEX "Notice_priority_pinned_idx" ON "tenant_altibio"."Notice"("priority", "pinned");

-- CreateIndex
CREATE INDEX "NoticeRecipient_clientId_idx" ON "tenant_altibio"."NoticeRecipient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeRecipient_noticeId_clientId_key" ON "tenant_altibio"."NoticeRecipient"("noticeId", "clientId");

-- CreateIndex
CREATE INDEX "NoticeReadLog_clientId_idx" ON "tenant_altibio"."NoticeReadLog"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeReadLog_noticeId_clientId_key" ON "tenant_altibio"."NoticeReadLog"("noticeId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProject_code_key" ON "tenant_altibio"."ProcurementProject"("code");

-- CreateIndex
CREATE INDEX "ProcurementProject_category_status_idx" ON "tenant_altibio"."ProcurementProject"("category", "status");

-- CreateIndex
CREATE INDEX "ProcurementProject_orderDate_idx" ON "tenant_altibio"."ProcurementProject"("orderDate");

-- CreateIndex
CREATE INDEX "ProcurementShipment_projectId_idx" ON "tenant_altibio"."ProcurementShipment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UdiReport_reportMonth_key" ON "tenant_altibio"."UdiReport"("reportMonth");

-- CreateIndex
CREATE INDEX "UdiReportItem_reportId_idx" ON "tenant_altibio"."UdiReportItem"("reportId");

-- CreateIndex
CREATE INDEX "UdiReportItem_clientId_idx" ON "tenant_altibio"."UdiReportItem"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityDocument_code_key" ON "tenant_altibio"."QualityDocument"("code");

-- CreateIndex
CREATE INDEX "QualityDocument_kind_active_idx" ON "tenant_altibio"."QualityDocument"("kind", "active");

-- CreateIndex
CREATE INDEX "QualityDocument_category_idx" ON "tenant_altibio"."QualityDocument"("category");

-- CreateIndex
CREATE INDEX "TransactionLedger_txnDate_idx" ON "tenant_altibio"."TransactionLedger"("txnDate");

-- CreateIndex
CREATE INDEX "TransactionLedger_clientCode_idx" ON "tenant_altibio"."TransactionLedger"("clientCode");

-- CreateIndex
CREATE INDEX "TransactionLedger_productCode_idx" ON "tenant_altibio"."TransactionLedger"("productCode");

-- CreateIndex
CREATE INDEX "TransactionLedger_kind_txnDate_idx" ON "tenant_altibio"."TransactionLedger"("kind", "txnDate");

-- CreateIndex
CREATE INDEX "TransactionLedger_voucherNo_idx" ON "tenant_altibio"."TransactionLedger"("voucherNo");

-- AddForeignKey
ALTER TABLE "tenant_altibio"."NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "tenant_altibio"."Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."NoticeReadLog" ADD CONSTRAINT "NoticeReadLog_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "tenant_altibio"."Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."NoticeReadLog" ADD CONSTRAINT "NoticeReadLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ProcurementShipment" ADD CONSTRAINT "ProcurementShipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "tenant_altibio"."ProcurementProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."UdiReportItem" ADD CONSTRAINT "UdiReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "tenant_altibio"."UdiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."UdiReportItem" ADD CONSTRAINT "UdiReportItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
