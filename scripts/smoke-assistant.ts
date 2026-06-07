/**
 * smoke-assistant — 지원 챗봇 백엔드 핸들러 검증 (in-process, 실DB).
 *
 * 라우트 핸들러를 직접 호출해 미들웨어/서버 없이 검증한다(공유 dev 서버 비건드림).
 *   - catalog GET : 토큰 인증 / 미인증·잘못된토큰 401
 *   - query  POST : ADMIN vs CLIENT 행-레벨 강제 증명
 *       (에이전트가 permissions 를 안 보내도 서버가 CLIENT→ownClientOnly 강제)
 *
 * 전제: DB 가 떠 있어야 함(.env.local DATABASE_URL/NEXTAUTH_SECRET).
 * 실행: npx tsx scripts/smoke-assistant.ts
 */
import { prisma } from "../src/lib/prisma";
import { signAssistantToken } from "../src/lib/assistant/token";
import { GET as catalogGET } from "../src/app/api/assistant/catalog/route";
import { POST as queryPOST } from "../src/app/api/assistant/query/route";

async function callCatalog(authHeader: string | null) {
  const r = await catalogGET(
    new Request("http://local/api/assistant/catalog", {
      headers: authHeader ? { Authorization: authHeader } : {},
    }),
  );
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* non-json */
  }
  return { status: r.status, body: body as Record<string, unknown> | null };
}

async function callQuery(token: string, spec: unknown) {
  const r = await queryPOST(
    new Request("http://local/api/assistant/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ spec }),
    }),
  );
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* non-json */
  }
  return { status: r.status, body: body as Record<string, unknown> | null };
}

function kpiValueOf(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  const r = result as { value?: unknown; series?: Array<{ value?: unknown }> };
  if (typeof r.value === "number") return r.value;
  if (Array.isArray(r.series)) {
    return r.series.reduce((s, x) => s + (Number(x?.value) || 0), 0);
  }
  return null;
}

async function findInvoiceLikeSpec(): Promise<Record<string, unknown> | null> {
  const widgets = await prisma.dashboardWidget.findMany({
    where: { preset: "spec:custom" },
  });
  for (const w of widgets) {
    const cfg = w.config as { spec?: { data?: { source?: string } } } | null;
    const spec = cfg?.spec;
    if (spec?.data?.source === "invoice" || spec?.data?.source === "ledger") {
      return spec as Record<string, unknown>;
    }
  }
  return null;
}

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  // eslint-disable-next-line no-console
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["TENANT_OWNER", "ADMIN"] } },
  });
  const client = await prisma.user.findFirst({
    where: { role: "CLIENT", clientId: { not: null } },
  });
  if (!admin) throw new Error("ADMIN/OWNER 유저 없음");
  if (!client) throw new Error("CLIENT 유저(clientId 연결) 없음 — 시드 확인");

  const adminTok = signAssistantToken({
    userId: admin.id,
    role: admin.role,
    clientId: null,
    tenantCode: "altibio",
  })!;
  const clientTok = signAssistantToken({
    userId: client.id,
    role: client.role,
    clientId: client.clientId!,
    tenantCode: "altibio",
  })!;

  // 1) catalog 토큰 인증
  const cat = await callCatalog(`Bearer ${adminTok.token}`);
  check(
    "catalog 토큰 인증 → 200 + sources",
    cat.status === 200 && Array.isArray(cat.body?.sources),
    `status=${cat.status} sources=${(cat.body?.sources as unknown[])?.length}`,
  );

  // 2) catalog 미인증 → 401
  const noTok = await callCatalog(null);
  check("catalog 토큰 없음 → 401", noTok.status === 401, `status=${noTok.status}`);

  // 3) catalog 잘못된 토큰 → 401
  const badTok = await callCatalog("Bearer not.a.realtoken");
  check(
    "catalog 잘못된 토큰 → 401",
    badTok.status === 401,
    `status=${badTok.status}`,
  );

  // 3b) query 미인증 → 401
  const qNoTok = await queryPOST(
    new Request("http://local/api/assistant/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: {} }),
    }),
  );
  check("query 토큰 없음 → 401", qNoTok.status === 401, `status=${qNoTok.status}`);

  // 4) query — ADMIN vs CLIENT 행-레벨 강제
  const spec = await findInvoiceLikeSpec();
  if (!spec) {
    // eslint-disable-next-line no-console
    console.log("ℹ invoice/ledger spec 위젯 없음 — query 비교 스킵");
  } else {
    // 에이전트가 permissions 를 안 보냈다고 가정 → 서버가 강제하는지 검증
    const bare = { ...spec, permissions: undefined };
    const a = await callQuery(adminTok.token, bare);
    const c = await callQuery(clientTok.token, bare);
    const av = kpiValueOf((a.body as { result?: unknown })?.result);
    const cv = kpiValueOf((c.body as { result?: unknown })?.result);
    check("query ADMIN → 200", a.status === 200, `status=${a.status} value=${av}`);
    check(
      "query CLIENT → 200 (스코프 적용)",
      c.status === 200,
      `status=${c.status} value=${cv}`,
    );
    if (av != null && cv != null) {
      check(
        "CLIENT ≤ ADMIN (자기 거래처만 — 행-레벨 서버 강제)",
        cv <= av,
        `client=${cv} admin=${av}`,
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error("smoke-assistant 실패:", e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
