-- CreateTable
CREATE TABLE "tenant_altibio"."SalesTarget" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "clientType" "tenant_altibio"."ClientType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesTarget_month_idx" ON "tenant_altibio"."SalesTarget"("month");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_salesRepId_month_clientType_key" ON "tenant_altibio"."SalesTarget"("salesRepId", "month", "clientType");
