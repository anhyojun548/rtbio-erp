import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  startShipment,
  moveShipmentStage,
  holdShipment,
  resumeShipment,
} from "@/lib/actions/shipment";

type Ctx = { params: { id: string } };

const unauthorized = () =>
  Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { to, stageId, reason, note } = body as {
    to?: string;
    stageId?: string;
    reason?: string;
    note?: string;
  };

  let res;
  switch (to) {
    case "START":
      res = await startShipment(params.id, { note: note ?? undefined });
      break;
    case "MOVE":
      if (!stageId) {
        return Response.json(
          { ok: false, error: "MOVE 전환 시 stageId 필수" },
          { status: 400 },
        );
      }
      res = await moveShipmentStage(params.id, {
        toStageId: stageId,
        note: note ?? undefined,
      });
      break;
    case "HOLD":
      res = await holdShipment(params.id, { reason: reason ?? "" });
      break;
    case "RESUME":
      res = await resumeShipment(params.id, { note: note ?? undefined });
      break;
    default:
      return Response.json(
        { ok: false, error: `Unknown transition: ${to}` },
        { status: 400 },
      );
  }

  if (!res.ok) {
    return Response.json({ ok: false, error: res.error }, { status: 400 });
  }

  return Response.json(res.data);
}
