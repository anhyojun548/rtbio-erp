import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

export default async function CeoPortalRedirect() {
  await requireRole("TENANT_OWNER", "SUPER_ADMIN");
  redirect("/portals/ceo-portal.html");
}
