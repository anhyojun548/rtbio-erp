import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listProcurementProjects } from "@/lib/actions/procurement";
import type { ProcurementCategory, ProcurementStatus } from "@prisma/client";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const rows = await listProcurementProjects({
    category: (url.searchParams.get("category") as ProcurementCategory) ?? undefined,
    status: (url.searchParams.get("status") as ProcurementStatus) ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });

  return Response.json(rows);
}
