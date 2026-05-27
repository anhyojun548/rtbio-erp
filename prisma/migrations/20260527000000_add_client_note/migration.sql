-- AddClientNote: 거래처에 영업 메모 컬럼 추가
--
-- note: 경쟁업체 / 단가 협상 / 특이사항 등 자유 텍스트 메모.
--       NULL = 메모 없음. prototype 의 CLIENT_EXTRA.competitor 와 1:1 매핑.

ALTER TABLE "tenant_altibio"."Client"
  ADD COLUMN "note" TEXT;
