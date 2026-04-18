-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant_altibio";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_OWNER', 'ADMIN', 'QC', 'EXEC', 'CLIENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "tenant_altibio"."ClientType" AS ENUM ('AGENCY', 'HOSPITAL', 'OTHER');

-- CreateEnum
CREATE TYPE "tenant_altibio"."OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'HOLD', 'REJECTED', 'SHIPPING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tenant_altibio"."InventoryLogType" AS ENUM ('RESERVE', 'RELEASE', 'SHIP', 'RECEIVE', 'ADJUST_IN', 'ADJUST_OUT', 'RETURN');

-- CreateEnum
CREATE TYPE "tenant_altibio"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tenant_altibio"."PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "tenant_altibio"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "tenant_altibio"."EmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "tenantId" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "part" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiryMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ProductSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "physicalStock" INTEGER NOT NULL DEFAULT 0,
    "availableStock" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ExpiryLot" (
    "id" TEXT NOT NULL,
    "productSizeId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ExpiryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Client" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "tenant_altibio"."ClientType" NOT NULL,
    "businessNumber" TEXT,
    "representative" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "paymentTerms" TEXT,
    "salesRepId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ClientDiscount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "discountRate" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ClientDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ClientFixedPrice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fixedPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ClientFixedPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "tenant_altibio"."OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "invoiceIssued" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "billingMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "basePriceAtOrder" DECIMAL(12,2) NOT NULL,
    "discountRateAtOrder" DECIMAL(5,4),
    "fixedPriceAppliedAtOrder" BOOLEAN NOT NULL DEFAULT false,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."KanbanColumn" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "KanbanColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currentStageId" TEXT NOT NULL,
    "enteredStageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "holdReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ShipmentAssignee" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ShipmentStageLog" (
    "id" BIGSERIAL NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "movedBy" TEXT,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ShipmentStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."InventoryLog" (
    "id" BIGSERIAL NOT NULL,
    "productSizeId" TEXT NOT NULL,
    "type" "tenant_altibio"."InventoryLogType" NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "physicalAfter" INTEGER NOT NULL,
    "availableAfter" INTEGER NOT NULL,
    "relatedOrderId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "productSizeId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "supplyAmount" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" "tenant_altibio"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ClosingLedger" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "closingMonth" TEXT NOT NULL,
    "carryOver" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlySales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "received" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ClosingLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Payment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "status" "tenant_altibio"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "bankTxnId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."BankTransaction" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."SalesAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,

    CONSTRAINT "SalesAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Conference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Conference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."ConferenceVisitor" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "affiliation" TEXT,
    "assignedRepId" TEXT,
    "contactStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ConferenceVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."SalesContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "SalesContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."DataUsage" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "DataUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."DashboardWidget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 6,
    "height" INTEGER NOT NULL DEFAULT 4,
    "overrideDateRange" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "tenant_altibio"."NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."EmailQueue" (
    "id" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "ccAddress" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template" TEXT,
    "attachments" JSONB,
    "status" "tenant_altibio"."EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_altibio"."TenantSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TenantSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "public"."Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "public"."Tenant"("subdomain");

-- CreateIndex
CREATE INDEX "Tenant_subdomain_idx" ON "public"."Tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "public"."User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_timestamp_idx" ON "public"."AuditLog"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "public"."AuditLog"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "tenant_altibio"."Product"("code");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "tenant_altibio"."Product"("category");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "tenant_altibio"."Product"("brand");

-- CreateIndex
CREATE INDEX "ProductSize_productId_idx" ON "tenant_altibio"."ProductSize"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_sizeCode_key" ON "tenant_altibio"."ProductSize"("productId", "sizeCode");

-- CreateIndex
CREATE INDEX "ExpiryLot_productSizeId_expiryDate_idx" ON "tenant_altibio"."ExpiryLot"("productSizeId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "tenant_altibio"."Client"("code");

-- CreateIndex
CREATE INDEX "Client_type_idx" ON "tenant_altibio"."Client"("type");

-- CreateIndex
CREATE INDEX "Client_salesRepId_idx" ON "tenant_altibio"."Client"("salesRepId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDiscount_clientId_category_key" ON "tenant_altibio"."ClientDiscount"("clientId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFixedPrice_clientId_productId_key" ON "tenant_altibio"."ClientFixedPrice"("clientId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "tenant_altibio"."Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_clientId_orderDate_idx" ON "tenant_altibio"."Order"("clientId", "orderDate");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "tenant_altibio"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderDate_idx" ON "tenant_altibio"."Order"("orderDate");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "tenant_altibio"."OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "tenant_altibio"."OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanColumn_key_key" ON "tenant_altibio"."KanbanColumn"("key");

-- CreateIndex
CREATE INDEX "KanbanColumn_sortOrder_idx" ON "tenant_altibio"."KanbanColumn"("sortOrder");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "tenant_altibio"."Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_currentStageId_idx" ON "tenant_altibio"."Shipment"("currentStageId");

-- CreateIndex
CREATE INDEX "ShipmentAssignee_userId_idx" ON "tenant_altibio"."ShipmentAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentAssignee_shipmentId_stageId_userId_key" ON "tenant_altibio"."ShipmentAssignee"("shipmentId", "stageId", "userId");

-- CreateIndex
CREATE INDEX "ShipmentStageLog_shipmentId_movedAt_idx" ON "tenant_altibio"."ShipmentStageLog"("shipmentId", "movedAt");

-- CreateIndex
CREATE INDEX "InventoryLog_productSizeId_createdAt_idx" ON "tenant_altibio"."InventoryLog"("productSizeId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_productSizeId_createdAt_idx" ON "tenant_altibio"."InventoryAdjustment"("productSizeId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_reason_idx" ON "tenant_altibio"."InventoryAdjustment"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "tenant_altibio"."Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_clientId_issueDate_idx" ON "tenant_altibio"."Invoice"("clientId", "issueDate");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "tenant_altibio"."Invoice"("status");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "tenant_altibio"."InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "ClosingLedger_closingMonth_idx" ON "tenant_altibio"."ClosingLedger"("closingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingLedger_clientId_closingMonth_key" ON "tenant_altibio"."ClosingLedger"("clientId", "closingMonth");

-- CreateIndex
CREATE INDEX "Payment_clientId_paidAt_idx" ON "tenant_altibio"."Payment"("clientId", "paidAt");

-- CreateIndex
CREATE INDEX "BankTransaction_txnDate_idx" ON "tenant_altibio"."BankTransaction"("txnDate");

-- CreateIndex
CREATE INDEX "BankTransaction_matched_idx" ON "tenant_altibio"."BankTransaction"("matched");

-- CreateIndex
CREATE INDEX "SalesAssignment_salesRepId_idx" ON "tenant_altibio"."SalesAssignment"("salesRepId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAssignment_clientId_salesRepId_key" ON "tenant_altibio"."SalesAssignment"("clientId", "salesRepId");

-- CreateIndex
CREATE INDEX "Conference_startDate_idx" ON "tenant_altibio"."Conference"("startDate");

-- CreateIndex
CREATE INDEX "ConferenceVisitor_conferenceId_idx" ON "tenant_altibio"."ConferenceVisitor"("conferenceId");

-- CreateIndex
CREATE INDEX "ConferenceVisitor_assignedRepId_idx" ON "tenant_altibio"."ConferenceVisitor"("assignedRepId");

-- CreateIndex
CREATE INDEX "SalesContract_clientId_idx" ON "tenant_altibio"."SalesContract"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "DataUsage_month_category_key" ON "tenant_altibio"."DataUsage"("month", "category");

-- CreateIndex
CREATE INDEX "DashboardWidget_userId_position_idx" ON "tenant_altibio"."DashboardWidget"("userId", "position");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "tenant_altibio"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "EmailQueue_status_idx" ON "tenant_altibio"."EmailQueue"("status");

-- CreateIndex
CREATE INDEX "EmailQueue_createdAt_idx" ON "tenant_altibio"."EmailQueue"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "tenant_altibio"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ExpiryLot" ADD CONSTRAINT "ExpiryLot_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "tenant_altibio"."ProductSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ClientDiscount" ADD CONSTRAINT "ClientDiscount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ClientFixedPrice" ADD CONSTRAINT "ClientFixedPrice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ClientFixedPrice" ADD CONSTRAINT "ClientFixedPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "tenant_altibio"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "tenant_altibio"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "tenant_altibio"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."OrderItem" ADD CONSTRAINT "OrderItem_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "tenant_altibio"."ProductSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "tenant_altibio"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Shipment" ADD CONSTRAINT "Shipment_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "tenant_altibio"."KanbanColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ShipmentAssignee" ADD CONSTRAINT "ShipmentAssignee_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "tenant_altibio"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ShipmentStageLog" ADD CONSTRAINT "ShipmentStageLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "tenant_altibio"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."InventoryLog" ADD CONSTRAINT "InventoryLog_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "tenant_altibio"."ProductSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "tenant_altibio"."ProductSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "tenant_altibio"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "tenant_altibio"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ClosingLedger" ADD CONSTRAINT "ClosingLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."Payment" ADD CONSTRAINT "Payment_bankTxnId_fkey" FOREIGN KEY ("bankTxnId") REFERENCES "tenant_altibio"."BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."SalesAssignment" ADD CONSTRAINT "SalesAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_altibio"."ConferenceVisitor" ADD CONSTRAINT "ConferenceVisitor_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "tenant_altibio"."Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

