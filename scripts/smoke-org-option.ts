/**
 * Phase ORG-E 조직 옵션 스모크 — OrgOption 테이블 + User 스냅샷 불변성 검증.
 *
 * 시나리오:
 *   1. DEPARTMENT OrgOption 생성 + active=true 확인
 *   2. 임시 QC 직원에 department 스냅샷 저장 + 읽기 검증
 *   3. 옵션 soft-delete → 직원 department 스냅샷 불변 확인
 *   4. 중복 생성 시 unique 위반 throw 확인
 *   5. 임시 유저 + 옵션 삭제 + 잔여 0건 확인
 *
 * 실행: `npx tsx scripts/smoke-org-option.ts`
 */
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const SMOKE_LABEL = "__smoke_dept__";
const SMOKE_EMAIL = "smoke-org-option@altibio.local";

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: SMOKE_EMAIL } });
  await prisma.orgOption.deleteMany({
    where: { label: SMOKE_LABEL },
  });
}

async function main() {
  console.log(`[smoke-org-option] label=${SMOKE_LABEL} email=${SMOKE_EMAIL}`);
  await cleanup();

  // ── 테넌트 조회 ─────────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { code: "altibio" },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error("altibio 테넌트를 찾을 수 없습니다. 시드를 먼저 실행하세요.");
  console.log(`[smoke-org-option] tenant=${tenant.name} (${tenant.id})`);

  // ─── 1. DEPARTMENT OrgOption 생성 + active=true ──────
  const created = await prisma.orgOption.create({
    data: {
      tenantId: tenant.id,
      kind: "DEPARTMENT",
      label: SMOKE_LABEL,
      sortOrder: 999,
      createdBy: "smoke",
    },
  });
  if (!created.id) throw new Error(`[1] OrgOption 생성 실패`);
  const row1 = await prisma.orgOption.findUnique({ where: { id: created.id } });
  if (!row1) throw new Error(`[1] 생성 후 조회 실패`);
  if (row1.active !== true) throw new Error(`[1] active 기대 true, 실제 ${row1.active}`);
  if (row1.kind !== "DEPARTMENT") throw new Error(`[1] kind 기대 DEPARTMENT, 실제 ${row1.kind}`);
  if (row1.label !== SMOKE_LABEL) throw new Error(`[1] label 불일치 — 실제 ${row1.label}`);
  console.log(`✅ 1. DEPARTMENT OrgOption 생성 (id=${created.id}) active=true ✓`);

  // ─── 2. 임시 QC 직원 생성 + department 스냅샷 검증 ──
  const hash = await bcrypt.hash("TempPw!smoke1", 10);
  const user = await prisma.user.create({
    data: {
      email: SMOKE_EMAIL,
      password: hash,
      name: "스모크ORG",
      role: "QC",
      tenantId: tenant.id,
      department: SMOKE_LABEL,
      isTeamAdmin: false,
      active: true,
      createdBy: "smoke",
    },
  });
  if (!user.id) throw new Error(`[2] 유저 생성 실패`);
  const row2 = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row2) throw new Error(`[2] 생성 후 조회 실패`);
  if (row2.department !== SMOKE_LABEL)
    throw new Error(`[2] department 기대 "${SMOKE_LABEL}", 실제 "${row2.department}"`);
  console.log(`✅ 2. 임시 QC 직원 생성 (id=${user.id}) department="${SMOKE_LABEL}" ✓`);

  // ─── 3. 옵션 soft-delete → 직원 스냅샷 불변 확인 ────
  await prisma.orgOption.update({
    where: { id: created.id },
    data: { active: false },
  });
  const optRow = await prisma.orgOption.findUnique({ where: { id: created.id } });
  if (!optRow) throw new Error(`[3] 소프트 삭제 후 조회 실패`);
  if (optRow.active !== false)
    throw new Error(`[3] 소프트 삭제 후 active 기대 false, 실제 ${optRow.active}`);
  // 직원 department 는 여전히 __smoke_dept__ 여야 함
  const row3 = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row3) throw new Error(`[3] 직원 조회 실패`);
  if (row3.department !== SMOKE_LABEL)
    throw new Error(
      `[3] 스냅샷 불변 위반 — 기대 "${SMOKE_LABEL}", 실제 "${row3.department}"`,
    );
  console.log(
    `✅ 3. 옵션 soft-delete 후 user.department="${row3.department}" 불변 ✓`,
  );

  // ─── 4. 중복 생성 → unique 위반 throw 확인 ───────────
  let duplicateThrew = false;
  try {
    // 동일 (tenantId, kind, label) — unique 제약 위반 예상
    await prisma.orgOption.create({
      data: {
        tenantId: tenant.id,
        kind: "DEPARTMENT",
        label: SMOKE_LABEL,
        createdBy: "smoke",
      },
    });
  } catch (e) {
    duplicateThrew = true;
    const msg = (e as Error).message ?? "";
    console.log(`[4] unique 위반 메시지(일부): ${msg.slice(0, 80)}`);
  }
  if (!duplicateThrew)
    throw new Error(`[4] 중복 생성이 throw 하지 않았음 — unique 제약 미작동`);
  console.log(`✅ 4. 중복 생성 → unique 위반 throw 확인 ✓`);

  // ─── 5. 임시 유저 + 옵션 삭제 + 잔여 0건 확인 ────────
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.orgOption.delete({ where: { id: created.id } });

  const remainingUser = await prisma.user.count({ where: { email: SMOKE_EMAIL } });
  if (remainingUser !== 0)
    throw new Error(`[5] 임시 유저 잔여 ${remainingUser}건 — 클린업 실패`);

  const remainingOpt = await prisma.orgOption.count({
    where: { tenantId: tenant.id, label: SMOKE_LABEL },
  });
  if (remainingOpt !== 0)
    throw new Error(`[5] 임시 OrgOption 잔여 ${remainingOpt}건 — 클린업 실패`);

  console.log(`✅ 5. 임시 유저 + 옵션 삭제 + 잔여 0건 ✓`);

  console.log("\n✅ smoke-org-option PASSED");
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
