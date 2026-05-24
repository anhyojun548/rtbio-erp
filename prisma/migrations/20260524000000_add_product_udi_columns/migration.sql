-- AddProductUdiColumns: 제품에 식약처 UDI 등록 정보 컬럼 추가
--
-- udiCode: GS1 표준 14자리 UDI-DI (예: 08801234567890)
--          NULL = 미등록 제품 (공급내역 보고에서 제외)
-- udiRegisteredAt: 식약처 등록 완료일
-- udiCertificateUrl: 등록증 PDF 경로 (Blob Storage 선택)

ALTER TABLE "tenant_altibio"."Product"
  ADD COLUMN "udiCode"           TEXT,
  ADD COLUMN "udiRegisteredAt"   TIMESTAMP(3),
  ADD COLUMN "udiCertificateUrl" TEXT;

-- 부분 unique 인덱스: udiCode 는 NULL 허용, 채워진 값은 유일해야 함
CREATE UNIQUE INDEX "Product_udiCode_key" ON "tenant_altibio"."Product"("udiCode");

-- 보고서 생성 시 자주 조회되는 컬럼
CREATE INDEX "Product_udiCode_idx" ON "tenant_altibio"."Product"("udiCode");
