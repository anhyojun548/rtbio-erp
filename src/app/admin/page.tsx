import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function AdminPortalRedirect() {
  await requireRole("TENANT_OWNER", "SUPER_ADMIN", "ADMIN");
  redirect("/portals/admin-portal.html");
}
