import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function QcPortalRedirect() {
  await requireRole("TENANT_OWNER", "SUPER_ADMIN", "QC");
  redirect("/portals/qc-portal.html");
}
