/**
 * Phase 3 직원관리 스모크 — team.ts 술어 + DB 파이프라인 검증.
 *
 * 시나리오:
 *   1. 임시 QC 유저 생성 + isEffectiveTeamAdmin false 확인
 *   2. canGrantRole 술어 — 자기 팀 허용 · 타 팀 거부
 *   3. 비밀번호 재설정 + bcrypt.compare 검증
 *   4. isTeamAdmin 승격 → isEffectiveTeamAdmin true 전환
 *   5. 마지막 TENANT_OWNER 개수 확인 (가드 조건 문서화)
 *   6. 임시 유저 삭제 + 존재 확인
 *
 * 실행: `npx tsx scripts/smoke-users.ts`
 */
import { prisma } from "../src/lib/prisma";
import { isEffectiveTeamAdmin, canGrantRole } from "../src/lib/team";
import bcrypt from "bcryptjs";

const SMOKE_EMAIL = `smoke-qc-staff@altibio.local`;

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: SMOKE_EMAIL } });
}

async function main() {
  console.log(`[smoke-users] email=${SMOKE_EMAIL}`);
  await cleanup();

  // ── 테넌트 조회 ─────────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { code: "altibio" },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error("altibio 테넌트를 찾을 수 없습니다. 시드를 먼저 실행하세요.");
  console.log(`[smoke-users] tenant=${tenant.name} (${tenant.id})`);

  // ─── 1. 임시 QC 유저 생성 + isEffectiveTeamAdmin false ──
  const tempPw1 = "TempPw1!smoke";
  const hash1 = await bcrypt.hash(tempPw1, 10);
  const created = await prisma.user.create({
    data: {
      email: SMOKE_EMAIL,
      password: hash1,
      name: "스모크QC",
      role: "QC",
      tenantId: tenant.id,
      isTeamAdmin: false,
      active: true,
      createdBy: "smoke",
    },
  });
  if (!created.id) throw new Error(`[1] 유저 생성 실패`);
  const row1 = await prisma.user.findUnique({ where: { id: created.id } });
  if (!row1) throw new Error(`[1] 생성 후 조회 실패`);
  const effective1 = isEffectiveTeamAdmin({ role: row1.role, isTeamAdmin: row1.isTeamAdmin });
  if (effective1 !== false)
    throw new Error(`[1] isEffectiveTeamAdmin 기대 false, 실제 ${effective1}`);
  console.log(`✅ 1. QC 유저 생성 (id=${created.id}) + isEffectiveTeamAdmin=false ✓`);

  // ─── 2. canGrantRole 술어 검증 ────────────────────────
  // QC isTeamAdmin=true → 자기 팀(QC) 만 허용
  const actorQcLeader = { role: "QC" as const, isTeamAdmin: true };
  const grantQC = canGrantRole(actorQcLeader, "QC");
  const grantAdmin = canGrantRole(actorQcLeader, "ADMIN");
  const grantExec = canGrantRole(actorQcLeader, "EXEC");
  if (grantQC !== true)
    throw new Error(`[2] canGrantRole(QC leader, QC) 기대 true, 실제 ${grantQC}`);
  if (grantAdmin !== false)
    throw new Error(`[2] canGrantRole(QC leader, ADMIN) 기대 false, 실제 ${grantAdmin}`);
  if (grantExec !== false)
    throw new Error(`[2] canGrantRole(QC leader, EXEC) 기대 false, 실제 ${grantExec}`);
  // CLIENT/VIEWER 는 항상 거부
  const grantClient = canGrantRole(actorQcLeader, "CLIENT");
  if (grantClient !== false)
    throw new Error(`[2] canGrantRole(QC leader, CLIENT) 기대 false, 실제 ${grantClient}`);
  console.log(`✅ 2. canGrantRole — QC→QC:허용 · QC→ADMIN:거부 · QC→EXEC:거부 · CLIENT:거부 ✓`);

  // ─── 3. 비밀번호 재설정 + bcrypt.compare ──────────────
  const tempPw2 = "NewPw2!smoke";
  const hash2 = await bcrypt.hash(tempPw2, 10);
  await prisma.user.update({
    where: { id: created.id },
    data: { password: hash2 },
  });
  const row2 = await prisma.user.findUnique({ where: { id: created.id } });
  if (!row2) throw new Error(`[3] 업데이트 후 조회 실패`);
  const pwMatch = await bcrypt.compare(tempPw2, row2.password);
  if (!pwMatch)
    throw new Error(`[3] bcrypt.compare(newPw, hash) 실패 — hash=${row2.password}`);
  // 이전 비밀번호로는 실패해야 함
  const oldPwMatch = await bcrypt.compare(tempPw1, row2.password);
  if (oldPwMatch)
    throw new Error(`[3] 이전 비밀번호가 여전히 통과됨 — 재설정 미작동`);
  console.log(`✅ 3. 비밀번호 재설정 → bcrypt.compare 성공 / 이전 비번 거부 ✓`);

  // ─── 4. isTeamAdmin 승격 → isEffectiveTeamAdmin true ──
  await prisma.user.update({
    where: { id: created.id },
    data: { isTeamAdmin: true },
  });
  const row3 = await prisma.user.findUnique({ where: { id: created.id } });
  if (!row3) throw new Error(`[4] 승격 후 조회 실패`);
  const effective2 = isEffectiveTeamAdmin({ role: row3.role, isTeamAdmin: row3.isTeamAdmin });
  if (effective2 !== true)
    throw new Error(`[4] isEffectiveTeamAdmin 승격 후 기대 true, 실제 ${effective2}`);
  console.log(`✅ 4. isTeamAdmin 승격 → isEffectiveTeamAdmin=true ✓`);

  // ─── 5. 마지막 TENANT_OWNER 카운트 (비활성화 가드 문서화) ──
  const ownerCount = await prisma.user.count({
    where: { tenantId: tenant.id, role: "TENANT_OWNER", active: true },
  });
  if (typeof ownerCount !== "number" || ownerCount < 1)
    throw new Error(`[5] 활성 TENANT_OWNER 최소 1명 기대, 실제 ${ownerCount}`);
  // 가드 조건: ownerCount <= 1 이면 마지막 owner → 비활성화 차단
  const wouldBlock = ownerCount <= 1;
  console.log(
    `✅ 5. 활성 TENANT_OWNER = ${ownerCount}명 — ${wouldBlock ? "마지막 1명(비활성화 차단 조건 충족)" : "2명 이상(비활성화 허용)"} ✓`,
  );

  // ─── 6. 임시 유저 삭제 + 존재 확인 ──────────────────
  await prisma.user.delete({ where: { id: created.id } });
  const gone = await prisma.user.findUnique({ where: { id: created.id } });
  if (gone !== null)
    throw new Error(`[6] 삭제 후 유저가 여전히 존재 — id=${created.id}`);
  // 최종 임시 행 0건 확인
  const remaining = await prisma.user.count({ where: { email: SMOKE_EMAIL } });
  if (remaining !== 0)
    throw new Error(`[6] 잔여 임시 행 ${remaining}건 — 클린업 실패`);
  console.log(`✅ 6. 임시 유저 삭제 + 잔여 행 0건 ✓`);

  console.log("\n✅ smoke-users PASSED");
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
