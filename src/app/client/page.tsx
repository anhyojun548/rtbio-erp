import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function ClientPortalRedirect() {
  await requireRole("TENANT_OWNER", "SUPER_ADMIN", "CLIENT");
  redirect("/portals/client-portal.html");
}
