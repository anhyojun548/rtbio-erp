-- CreateEnum
CREATE TYPE "tenant_altibio"."OrgOptionKind" AS ENUM ('DEPARTMENT', 'JOB_TITLE');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "jobTitle" TEXT;

-- CreateTable
CREATE TABLE "tenant_altibio"."OrgOption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "tenant_altibio"."OrgOptionKind" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "OrgOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgOption_tenantId_kind_active_idx" ON "tenant_altibio"."OrgOption"("tenantId", "kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OrgOption_tenantId_kind_label_key" ON "tenant_altibio"."OrgOption"("tenantId", "kind", "label");
