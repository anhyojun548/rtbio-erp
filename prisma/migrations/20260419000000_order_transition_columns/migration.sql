-- Phase 3D-2b-2 — REJECT / HOLD 전이 사유 컬럼.
-- rejectedAt/Reason : REJECTED 시 기록. terminal 이므로 RESUME 없음.
-- heldAt/Reason     : HOLD 시 기록. RESUME 시 null 로 복귀 (감사로그에는 남음).

ALTER TABLE "tenant_altibio"."Order"
  ADD COLUMN "rejectedAt"     TIMESTAMP(3),
  ADD COLUMN "rejectedReason" TEXT,
  ADD COLUMN "heldAt"         TIMESTAMP(3),
  ADD COLUMN "heldReason"     TEXT;
