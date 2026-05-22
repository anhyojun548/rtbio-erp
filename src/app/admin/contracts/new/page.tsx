/**
 * 신규 판매 계약서 등록 — Phase 3G-2 (R20).
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listClients } from "@/lib/actions/client";
import { ContractForm } from "@/components/admin/contracts/ContractForm";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const clients = await listClients({ active: "ACTIVE" });
  const options = clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <Link
          href="/admin/contracts"
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ← 계약서 목록
        </Link>
        <h1 className="text-display m-0 mt-1">
          신규 판매 계약서
        </h1>
      </header>

      <ContractForm
        mode="create"
        clients={options}
        defaultClientId={searchParams.clientId}
      />
    </div>
  );
}
