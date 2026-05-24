import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function ExecPortalRedirect() {
  await requireRole("TENANT_OWNER", "SUPER_ADMIN", "EXEC");
  redirect("/portals/exec-portal.html");
}
