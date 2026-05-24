import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listQualityDocuments } from "@/lib/actions/quality-document";
import type { QualityDocKind } from "@prisma/client";

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const rows = await listQualityDocuments({
    kind: (url.searchParams.get("kind") as QualityDocKind) ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });

  return Response.json(rows);
}
