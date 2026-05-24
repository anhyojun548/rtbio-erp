import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSalesHistory,
  listAssignableSalesReps,
} from "@/lib/actions/sales-history";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);

  // ?reps=1 → 담당자 목록 반환
  if (url.searchParams.get("reps") === "1") {
    const reps = await listAssignableSalesReps();
    return Response.json(reps);
  }

  const salesRepId = url.searchParams.get("salesRepId");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  if (!salesRepId || !fromStr || !toStr) {
    return Response.json(
      { ok: false, error: "salesRepId, from, to 필수" },
      { status: 400 },
    );
  }

  try {
    const result = await getSalesHistory({
      salesRepId,
      from: new Date(fromStr),
      to: new Date(toStr),
    });
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "조회 오류";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
