/**
 * /api/inventory/adjustment
 *
 * 재고 변동 통합 endpoint — prototype qc-portal.html 의
 * - 입고 등록 (RECEIVE)
 * - 재고조정 (반품/폐기/실사조정/입고보정)
 * - 샘플 출고 (샘플출고)
 * 가 모두 호출.
 *
 * 분기 기준: body.type === "RECEIVE" → receiveStock,
 *           그 외(반품/폐기/실사조정/입고보정/샘플출고) → createAdjustment
 *
 * POST body 공통:
 *   { type: "RECEIVE" | "반품" | "폐기" | "실사조정" | "입고보정" | "샘플출고",
 *     productSizeId: string,
 *     qty: number,                 // 부호는 type 별 validator 에서 검증
 *     note?: string,
 *     approvedBy?: string }
 *
 * 응답: 200 { ok: true, ...result } | 400 { ok: false, error, fieldErrors? }
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { receiveStock, createAdjustment } from "@/lib/actions/inventory";
import type { AdjustReason } from "@/lib/validators/inventory";

const ADJUST_REASONS: AdjustReason[] = [
  "반품",
  "폐기",
  "실사조정",
  "입고보정",
  "샘플출고",
];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type as string | undefined;
  const productSizeId = body.productSizeId as string | undefined;
  // qty 는 폼/JSON 어디에서든 와도 validator(z.coerce.number)가 처리하므로 number 로 캐스팅.
  const qty = body.qty as number;
  const note = body.note as string | undefined;
  const approvedBy = body.approvedBy as string | undefined;

  if (!type || !productSizeId || qty === undefined || qty === null) {
    return Response.json(
      { ok: false, error: "type, productSizeId, qty 가 필요합니다." },
      { status: 400 },
    );
  }

  // RECEIVE 분기 — 입고
  if (type === "RECEIVE") {
    const res = await receiveStock({ productSizeId, qty, note });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: res.error, fieldErrors: res.fieldErrors },
        { status: 400 },
      );
    }
    return Response.json({ ok: true, ...res.data }, { status: 200 });
  }

  // 조정 분기 — 반품/폐기/실사조정/입고보정/샘플출고
  if (!ADJUST_REASONS.includes(type as AdjustReason)) {
    return Response.json(
      { ok: false, error: `알 수 없는 type: ${type}` },
      { status: 400 },
    );
  }

  const res = await createAdjustment({
    productSizeId,
    qty,
    reason: type as AdjustReason,
    note,
    approvedBy,
  });

  if (!res.ok) {
    return Response.json(
      { ok: false, error: res.error, fieldErrors: res.fieldErrors },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, ...res.data }, { status: 200 });
}
