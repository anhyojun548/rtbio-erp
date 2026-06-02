/**
 * DB 탐색기 스모크 — registry/query 헬퍼의 읽기/편집 가드를 실 DB 로 검증.
 *
 * 세션을 우회하고 Phase A 헬퍼(queryTable·updateRow·getTableDef)를 직접 호출한다.
 * 보안 경계(민감컬럼 제외·읽기전용 거부·editableFields 화이트리스트)가 실제로 작동하는지 확인.
 *
 * 시나리오:
 *   1. user 조회 → 어떤 행에도 password 키 없음 + (행 있으면) role(enum) 컬럼 포함 + tenant 필터
 *   2. order 조회 → columns 에 orderNumber AND status(enum) 포함
 *   3. order updateRow → editable=false → {ok:false} (읽기 전용 거부)
 *   4. 임시 OrgOption 생성 → label 편집 → ok + DB 반영 확인
 *   5. OrgOption kind 편집 시도 → editableFields 아님 → 무시(변경 안 됨)
 *   6. 임시 OrgOption 정리 + 잔여 0건
 *
 * 실행: `npx tsx scripts/smoke-db-explorer.ts`
 */
import { prisma } from "../src/lib/prisma";
import { getTableDef } from "../src/lib/db-explorer/registry";
import { queryTable, updateRow } from "../src/lib/db-explorer/query";

const SMOKE_LABEL = "__smoke_dbx__";
const SMOKE_LABEL_INIT = "__smoke_dbx_init__";

async function cleanup() {
  await prisma.orgOption.deleteMany({
    where: { label: { in: [SMOKE_LABEL, SMOKE_LABEL_INIT] } },
  });
}

async function main() {
  console.log(`[smoke-db-explorer] label=${SMOKE_LABEL}`);
  await cleanup();

  // ── 테넌트 조회 ─────────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { code: "altibio" },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error("altibio 테넌트를 찾을 수 없습니다. 시드를 먼저 실행하세요.");
  const tid = tenant.id;
  console.log(`[smoke-db-explorer] tenant=${tenant.name} (${tid})`);

  // ─── 1. user 조회 — password 키 없음 + role(enum) 컬럼 + tenant 필터 ──
  const userDef = getTableDef("user");
  if (!userDef) throw new Error(`[1] getTableDef('user') 가 undefined`);
  const userRes = await queryTable(userDef, { limit: 5, offset: 0, tenantId: tid });
  // 민감컬럼: 어떤 행에도 password 키가 존재하면 안 됨
  for (const row of userRes.rows as Record<string, unknown>[]) {
    if (Object.prototype.hasOwnProperty.call(row, "password"))
      throw new Error(`[1] user 행에 password 키가 노출됨 — 민감컬럼 누수`);
  }
  // 컬럼 메타에도 password 없어야 함
  const userColNames = userRes.columns.map((c) => c.name);
  if (userColNames.includes("password"))
    throw new Error(`[1] columns 에 password 포함 — select 누수`);
  // role(enum) 컬럼은 가장 중요 — 반드시 포함
  if (!userColNames.includes("role"))
    throw new Error(`[1] columns 에 role(enum) 누락 — 실제 ${userColNames.join(",")}`);
  // tenant 필터: 반환된 행은 전부 해당 테넌트여야 함 (select 에 tenantId 포함됨)
  for (const row of userRes.rows as Record<string, unknown>[]) {
    if (row.tenantId !== tid)
      throw new Error(`[1] tenant 필터 위반 — 행 tenantId=${String(row.tenantId)} ≠ ${tid}`);
  }
  console.log(
    `✅ 1. user 조회 — password 키 0건 · role(enum) 컬럼 포함 · ${userRes.rows.length}행 tenant 필터 ✓`,
  );

  // ─── 2. order 조회 — columns 에 orderNumber AND status(enum) ──
  const orderDef = getTableDef("order");
  if (!orderDef) throw new Error(`[2] getTableDef('order') 가 undefined`);
  const orderRes = await queryTable(orderDef, { limit: 5, offset: 0, tenantId: tid });
  const orderColNames = orderRes.columns.map((c) => c.name);
  if (!orderColNames.includes("orderNumber"))
    throw new Error(`[2] columns 에 orderNumber 누락 — 실제 ${orderColNames.join(",")}`);
  if (!orderColNames.includes("status"))
    throw new Error(`[2] columns 에 status(enum) 누락 — 실제 ${orderColNames.join(",")}`);
  console.log(
    `✅ 2. order 조회 — columns 에 orderNumber + status(enum) 포함 (${orderColNames.length}컬럼) ✓`,
  );

  // ─── 3. order updateRow — editable=false → {ok:false} ──
  const orderUpd = await updateRow(orderDef, "x-nonexistent-id", { status: "X" }, tid);
  if (orderUpd.ok !== false)
    throw new Error(`[3] order 편집이 거부되지 않음 — editable=false 가드 미작동`);
  console.log(`✅ 3. order(읽기전용) 편집 → {ok:false} "${orderUpd.error}" ✓`);

  // ─── 4. 임시 OrgOption 생성 → label 편집 → 반영 확인 ──
  const orgDef = getTableDef("orgOption");
  if (!orgDef) throw new Error(`[4] getTableDef('orgOption') 가 undefined`);
  const created = await prisma.orgOption.create({
    data: {
      tenantId: tid,
      kind: "DEPARTMENT",
      label: SMOKE_LABEL_INIT,
      sortOrder: 900,
      createdBy: "smoke",
    },
  });
  const upd4 = await updateRow(orgDef, created.id, { label: SMOKE_LABEL }, tid);
  if (upd4.ok !== true)
    throw new Error(
      `[4] orgOption label 편집 실패 — ${"error" in upd4 ? upd4.error : "(이유 없음)"}`,
    );
  const row4 = await prisma.orgOption.findUnique({ where: { id: created.id } });
  if (!row4) throw new Error(`[4] 편집 후 조회 실패`);
  if (row4.label !== SMOKE_LABEL)
    throw new Error(`[4] label 미반영 — 기대 "${SMOKE_LABEL}", 실제 "${row4.label}"`);
  console.log(`✅ 4. orgOption label 편집 → "${SMOKE_LABEL_INIT}" → "${row4.label}" 반영 ✓`);

  // ─── 5. OrgOption kind 편집 시도 → editableFields 아님 → 무시 ──
  // kind 는 editableFields(label/sortOrder/active)에 없음 → coerce/update 대상에서 제외.
  // patch 에 kind 만 있으면 변경할 필드가 없어 {ok:false} 반환 + DB 의 kind 불변.
  const kindBefore = row4.kind;
  const upd5 = await updateRow(orgDef, created.id, { kind: "JOB_TITLE" }, tid);
  if (upd5.ok !== false)
    throw new Error(`[5] kind 편집이 거부되지 않음 — editableFields 화이트리스트 미작동`);
  const row5 = await prisma.orgOption.findUnique({ where: { id: created.id } });
  if (!row5) throw new Error(`[5] 재조회 실패`);
  if (row5.kind !== kindBefore)
    throw new Error(
      `[5] kind 가 변경됨 — 기대 "${kindBefore}", 실제 "${row5.kind}" (화이트리스트 누수)`,
    );
  console.log(
    `✅ 5. orgOption kind 편집 거부 → {ok:false} "${upd5.error}" · kind="${row5.kind}" 불변 ✓`,
  );

  // ─── 6. 임시 OrgOption 정리 + 잔여 0건 ──
  await prisma.orgOption.delete({ where: { id: created.id } });
  const remaining = await prisma.orgOption.count({
    where: { label: { in: [SMOKE_LABEL, SMOKE_LABEL_INIT] } },
  });
  if (remaining !== 0) throw new Error(`[6] 임시 OrgOption 잔여 ${remaining}건 — 클린업 실패`);
  console.log(`✅ 6. 임시 OrgOption 삭제 + 잔여 0건 ✓`);

  console.log("\n✅ smoke-db-explorer PASSED");
}

main()
  .catch(async (e) => {
    console.error("❌", e);
    await cleanup();
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
