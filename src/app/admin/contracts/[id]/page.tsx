/**
 * 판매 계약서 상세/편집 — Phase 3G-2 (R20).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getContract } from "@/lib/actions/sales-contract";
import { listClients } from "@/lib/actions/client";
import { CONTRACT_STATUS_LABEL } from "@/lib/validators/sales-contract";
import { ContractForm } from "@/components/admin/contracts/ContractForm";

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const [contract, clients] = await Promise.all([
    getContract(params.id),
    listClients({ active: "ACTIVE" }),
  ]);
  if (!contract) notFound();

  const options = clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  // 목록에 없으면(비활성 거래처) 계약서의 거래처를 보강
  if (!options.find((c) => c.id === contract.client.id)) {
    options.unshift({
      id: contract.client.id,
      code: contract.client.code,
      name: contract.client.name,
    });
  }

  const statusClass: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    ENDING_SOON: "bg-amber-100 text-amber-700",
    EXPIRED: "bg-red-100 text-red-700",
    FUTURE: "bg-sky-100 text-sky-700",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/contracts"
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            ← 계약서 목록
          </Link>
          <h1 className="text-display m-0 mt-1">
            {contract.title}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Link
              href={`/admin/clients/${contract.client.id}`}
              className="text-caption text-primary hover:underline"
            >
              {contract.client.name}
            </Link>
            <span className="text-xs text-slate-400 font-mono">
              {contract.client.code}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${statusClass[contract.status]}`}
            >
              {CONTRACT_STATUS_LABEL[contract.status]}
              {contract.status === "ENDING_SOON" && contract.daysLeft !== null
                ? ` · ${contract.daysLeft}일 남음`
                : ""}
              {contract.status === "EXPIRED" && contract.daysLeft !== null
                ? ` · ${Math.abs(contract.daysLeft)}일 경과`
                : ""}
            </span>
          </div>
        </div>
      </header>

      <ContractForm
        mode="edit"
        clients={options}
        initial={{
          id: contract.id,
          clientId: contract.clientId,
          title: contract.title,
          startDate: contract.startDate.toISOString().slice(0, 10),
          endDate: contract.endDate
            ? contract.endDate.toISOString().slice(0, 10)
            : null,
          pdfUrl: contract.pdfUrl,
          signed: contract.signed,
          note: contract.note,
        }}
      />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
        <div>
          등록일: {contract.createdAt.toISOString().slice(0, 16).replace("T", " ")}
        </div>
        <div>
          수정일: {contract.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
        </div>
        {contract.createdBy && <div>등록자 ID: {contract.createdBy}</div>}
      </section>
    </div>
  );
}
