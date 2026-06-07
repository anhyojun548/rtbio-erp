/**
 * 매입 수기 입력 + 매입장 조회 API (경영지원)
 *
 *   POST   /api/admin/purchases                      — 매입 전표 생성
 *   GET    /api/admin/purchases?mode=history&limit=  — 매입 이력(전표 그룹, 기본)
 *   GET    /api/admin/purchases?mode=journal&from&to&q&limit — 매입장 flat lines
 *   DELETE /api/admin/purchases?voucherNo=           — 수기 매입 전표 삭제
 *
 * 권한은 액션 내부 requireRole 로 강제(입력/삭제 ADMIN·TENANT_OWNER).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createPurchaseEntry,
  listPurchaseEntries,
  deletePurchaseEntry,
  getPurchaseJournal,
} from "@/lib/actions/purchase";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

const forbidden = (e: unknown) =>
  Response.json(
    { ok: false, error: (e as Error).message || "권한이 없습니다" },
    { status: 403 },
  );

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "history";
  try {
    if (mode === "journal") {
      const res = await getPurchaseJournal({
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        limit: url.searchParams.get("limit")
          ? Number(url.searchParams.get("limit"))
          : undefined,
      });
      return Response.json(res);
    }
    const entries = await listPurchaseEntries({
      limit: url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    });
    return Response.json({ entries });
  } catch (e) {
    return forbidden(e);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  try {
    const res = await createPurchaseEntry(body);
    if (!res.ok) {
      return Response.json(
        { ok: false, error: res.error, fieldErrors: (res as { fieldErrors?: unknown }).fieldErrors },
        { status: 400 },
      );
    }
    return Response.json(res.data, { status: 201 });
  } catch (e) {
    return forbidden(e);
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const voucherNo = url.searchParams.get("voucherNo") ?? "";
  try {
    const res = await deletePurchaseEntry(voucherNo);
    if (!res.ok) {
      return Response.json({ ok: false, error: res.error }, { status: 400 });
    }
    return Response.json(res.data);
  } catch (e) {
    return forbidden(e);
  }
}
