/**
 * 거래처 포털 — 내 거래처 프로필 (읽기 전용).
 *
 * 수정은 내부 경영지원팀에서 처리. 문의는 담당 영업사원에게.
 */
import { getMyClient } from "@/lib/actions/client-portal";
import { notFound } from "next/navigation";

export default async function ClientProfilePage() {
  const client = await getMyClient();
  if (!client) notFound();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">내 거래처 정보</h1>
        <p className="text-sm text-slate-500 mt-1">
          정보 수정은 담당 영업사원에게 요청해주세요.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-3 text-sm">
        <Row k="거래처 코드" v={client.code} mono />
        <Row k="거래처명" v={client.name} />
        <Row k="유형" v={CLIENT_TYPE_LABEL[client.type] ?? client.type} />
        <Row k="사업자번호" v={client.businessNumber ?? "-"} />
        <Row k="대표자" v={client.representative ?? "-"} />
        <Row k="전화번호" v={client.phone ?? "-"} />
        <Row k="이메일" v={client.email ?? "-"} />
        <Row k="기본 주소" v={client.address ?? "-"} />
        <Row k="우편번호" v={client.postalCode ?? "-"} />
        <Row k="결제조건" v={client.paymentTerms ?? "-"} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">
            배송지 ({client.addresses.length}곳)
          </h2>
        </div>
        {client.addresses.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            등록된 배송지가 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {client.addresses.map((a) => (
              <li key={a.id} className="p-4 flex items-start gap-3">
                {a.isDefault && (
                  <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 mt-0.5">
                    기본
                  </span>
                )}
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">
                    {a.label}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {a.address} {a.addressDetail ?? ""}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {a.recipientName && <>수령인 {a.recipientName}</>}
                    {a.phone && <> · 📞 {a.phone}</>}
                    {a.postalCode && <> · 우 {a.postalCode}</>}
                  </div>
                  {a.memo && (
                    <div className="text-[11px] text-slate-400 mt-1 italic">
                      {a.memo}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-4 gap-3">
        <StatCard label="총 발주" value={`${client._count.orders} 건`} />
        <StatCard label="거래명세서" value={`${client._count.invoices} 건`} />
        <StatCard label="수금 이력" value={`${client._count.payments} 건`} />
        <StatCard label="계약서" value={`${client._count.contracts} 건`} />
      </section>
    </div>
  );
}

const CLIENT_TYPE_LABEL: Record<string, string> = {
  AGENCY: "대리점",
  HOSPITAL: "병원",
  PHARMACY: "약국",
  OTHER: "기타",
};

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex">
      <dt className="w-28 text-slate-500">{k}</dt>
      <dd className={`flex-1 text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
        {v}
      </dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold mt-1 tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
