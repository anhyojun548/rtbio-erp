import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getClient } from "@/lib/actions/client";
import { ClientForm } from "@/components/admin/clients/ClientForm";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  await requireRole("TENANT_OWNER", "ADMIN");
  const client = await getClient(params.id);
  if (!client) notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">거래처 편집</h1>
        <p className="text-sm text-slate-500 mt-1 font-mono">{client.code}</p>
      </header>
      <ClientForm
        mode="edit"
        initial={{
          id: client.id,
          code: client.code,
          name: client.name,
          type: client.type,
          businessNumber: client.businessNumber ?? undefined,
          representative: client.representative ?? undefined,
          phone: client.phone ?? undefined,
          email: client.email ?? undefined,
          address: client.address ?? undefined,
          postalCode: client.postalCode ?? undefined,
          paymentTerms: client.paymentTerms ?? undefined,
          salesRepId: client.salesRepId ?? undefined,
          active: client.active,
        }}
      />
    </div>
  );
}
