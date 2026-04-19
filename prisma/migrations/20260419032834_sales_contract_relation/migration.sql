-- CreateIndex
CREATE INDEX "SalesContract_endDate_idx" ON "tenant_altibio"."SalesContract"("endDate");

-- AddForeignKey
ALTER TABLE "tenant_altibio"."SalesContract" ADD CONSTRAINT "SalesContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "tenant_altibio"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
