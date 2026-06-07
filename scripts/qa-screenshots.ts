/**
 * QA 가이드용 포털 스크린샷 자동 캡처 (puppeteer).
 *  - 비밀번호 입력 없이 NextAuth 세션 쿠키를 mint 해서 인증 (로컬 dev 한정).
 *  - owner 세션으로 admin/exec/qc/ceo, client 세션으로 client 포털 캡처.
 *  - 결과: docs/04-report/qa-test-guide/images/*.png
 * 실행: 개발 서버(localhost:3000) 가 떠 있는 상태에서 `npx tsx scripts/qa-screenshots.ts`
 */
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";
import puppeteer from "puppeteer";
import { encode } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const BASE = "http://localhost:3000";
const OUT = join(process.cwd(), "docs/04-report/qa-test-guide/images");
const MAX_AGE = 60 * 60 * 24 * 30;

function loadSecret(): string {
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^NEXTAUTH_SECRET\s*=\s*(.*)$/m);
    if (m && m[1]) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* fall through */
  }
  return (
    process.env.NEXTAUTH_SECRET ||
    "dev-only-change-in-prod-d8f3a1b9c7e5f2d4a6b8c0e1f3d5a7b9c1e3d5f7a9b1c3e5d7f9a1b3c5e7d9"
  );
}

type U = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  tenantId: string | null;
  clientId: string | null;
  isTeamAdmin: boolean;
  tenant: { code: string | null } | null;
};

function tokenOf(u: U) {
  return {
    name: u.name,
    email: u.email,
    sub: u.id,
    userId: u.id,
    role: u.role,
    tenantId: u.tenantId,
    tenantCode: u.tenant?.code ?? null,
    clientId: u.clientId ?? null,
    isTeamAdmin: u.isTeamAdmin ?? false,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const secret = loadSecret();

  const owner = (await prisma.user.findUnique({
    where: { email: "owner@rtbio.com" },
    include: { tenant: true },
  })) as U | null;
  const client = (await prisma.user.findFirst({
    where: { role: "CLIENT", active: true, clientId: { not: null } },
    include: { tenant: true },
    orderBy: { email: "asc" },
  })) as U | null;

  if (!owner) throw new Error("owner@rtbio.com 사용자를 찾을 수 없습니다.");
  const ownerToken = await encode({ secret, maxAge: MAX_AGE, token: tokenOf(owner) });
  const clientToken = client
    ? await encode({ secret, maxAge: MAX_AGE, token: tokenOf(client) })
    : null;

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  async function auth(token: string) {
    await page.deleteCookie({ name: "next-auth.session-token", url: BASE }).catch(() => {});
    await page.setCookie({ name: "next-auth.session-token", value: token, url: BASE, httpOnly: true });
  }

  async function shot(url: string, file: string, pageId?: string) {
    try {
      await page.goto(BASE + url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2800)); // data-loader 렌더 대기
      if (pageId) {
        const ok = await page.evaluate((pid: string) => {
          try {
            // @ts-ignore - 브라우저 전역
            if (typeof goTo === "function") goTo(pid);
          } catch (e) {
            /* noop */
          }
          const el = document.getElementById(pid);
          return !!(el && getComputedStyle(el).display !== "none");
        }, pageId);
        if (!ok) {
          console.log("  skip (페이지 없음):", file, "/", pageId);
          return;
        }
        await new Promise((r) => setTimeout(r, 1600));
      }
      // 공지/모달 팝업 제거 (캡처 가림 방지)
      await page.evaluate(() => {
        document
          .querySelectorAll('[class*="overlay"],[class*="popup"],[class*="backdrop"],.modal,.modal-overlay')
          .forEach((el) => el.remove());
        document.body.style.overflow = "";
      });
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({ path: join(OUT, file) });
      console.log("  captured:", file);
    } catch (e) {
      console.log("  FAIL:", file, "-", (e as Error).message);
    }
  }

  console.log("[owner 세션] admin/exec/qc/ceo");
  await auth(ownerToken);
  await shot("/admin", "admin-dashboard.png");
  await shot("/admin", "admin-journal.png", "page-journal");
  await shot("/admin", "admin-invoices.png", "page-invoices");
  await shot("/admin", "admin-payments.png", "page-payments");
  await shot("/admin", "admin-clients.png", "page-clients");
  await shot("/exec", "exec-dashboard.png");
  await shot("/qc", "qc-dashboard.png");
  await shot("/qc", "qc-confirm.png", "page-confirm");
  await shot("/qc", "qc-shipments.png", "page-shipments");
  await shot("/qc", "qc-inventory.png", "page-inventory");
  await shot("/ceo", "ceo-dashboard.png");

  if (clientToken) {
    console.log("[client 세션] client (" + client?.email + ")");
    await auth(clientToken);
    await shot("/client", "client-dashboard.png");
    await shot("/client", "client-order.png", "page-order");
    await shot("/client", "client-history.png", "page-history");
  } else {
    console.log("CLIENT 사용자 없음 — client 포털 캡처 생략");
  }

  await browser.close();
  await prisma.$disconnect();
  console.log("완료 →", OUT);
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
