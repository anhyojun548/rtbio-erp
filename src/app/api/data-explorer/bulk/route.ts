/**
 * POST   /api/data-explorer/bulk — 대량 삽입
 * PATCH  /api/data-explorer/bulk — 조건부 일괄 수정
 * DELETE /api/data-explorer/bulk — importSource 배치 삭제
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  bulkInsertTransactions,
  bulkUpdateTransactions,
  deleteTransactionsByImportSource,
} from "@/lib/actions/transaction-ledger";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const importSource: string = body.importSource ?? "api-bulk";

  const res = await bulkInsertTransactions(rows, importSource);
  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: (res as any).fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const filter = body.filter ?? {};
  const patch  = body.patch  ?? {};

  const res = await bulkUpdateTransactions(filter, patch);
  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: (res as any).fieldErrors },
      { status: 400 },
    );
  }

  return Response.json(res.data);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const importSource: string | undefined = body.importSource;

  if (!importSource) {
    return Response.json(
      { ok: false, error: "importSource 가 필요합니다" },
      { status: 400 },
    );
  }

  const res = await deleteTransactionsByImportSource(importSource);
  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
