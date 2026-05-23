import { redirect } from "next/navigation";

/** Phase 5 임시 리다이렉트 — 통합 페이지로 이동 */
export default function Page() {
  redirect("/admin/orders?status=SUBMITTED");
}
