import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const u = session.user as any;
  return Response.json({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    tenantId: u.tenantId ?? null,
    tenantCode: u.tenantCode ?? null,
    clientId: u.clientId ?? null,
    isTeamAdmin: u.isTeamAdmin ?? false,
  });
}
