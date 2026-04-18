export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <header>
          <h1 className="text-3xl font-bold text-rtbio-primary">RTBIO ERP</h1>
          <p className="mt-2 text-sm text-slate-500">
            알티바이오 ERP · Phase 1 (Prisma 스키마) 진행 중
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-lg font-semibold">포털</h2>
          <ul className="space-y-1 text-sm">
            <li>경영지원 (admin)</li>
            <li>품질관리 (qc)</li>
            <li>영업 (exec)</li>
            <li>거래처 (client)</li>
            <li>임원진 (ceo)</li>
          </ul>
        </section>

        <footer className="border-t pt-4 text-xs text-slate-400">
          프로토타입은{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">/prototype/*.html</code>{" "}
          참조 · 실개발은 계약 기준(과업내용서 상세 2026-04-17) 따름
        </footer>
      </div>
    </main>
  );
}
