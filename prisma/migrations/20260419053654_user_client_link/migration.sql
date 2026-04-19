-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "public"."User"("clientId");
