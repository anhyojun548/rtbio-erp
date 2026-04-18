/**
 * 거래명세서 PDF 문서 — @react-pdf/renderer.
 *
 * 사용처: `/admin/invoices/[id]/pdf` 라우트 핸들러에서 `renderToBuffer(<InvoicePdfDocument .../>)` 로 렌더링.
 * 한글 폰트: 시스템 Helvetica 로는 한글이 ▯ 로 깨지므로 Noto Sans KR 을 CDN 에서 로드.
 *   - @react-pdf/renderer 는 Font.register 로 등록하면 서버 환경에서도 fetch 하여 사용.
 *   - 오프라인/컨테이너 환경에서 CDN 차단 시 `public/fonts/` 로 번들링 전환 필요.
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Noto Sans KR — CDN (한글 지원). 빌드 시점이 아닌 렌더 시점에 네트워크 접근.
Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2107@1.1/NotoSansKR-Regular.woff",
      fontWeight: "normal",
    },
    {
      src: "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2107@1.1/NotoSansKR-Bold.woff",
      fontWeight: "bold",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansKR",
    fontSize: 10,
    padding: 32,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "2pt solid #0f172a",
  },
  titleBlock: { flexDirection: "column" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#475569" },
  rightBlock: { flexDirection: "column", alignItems: "flex-end" },
  numberLabel: { fontSize: 9, color: "#64748b", marginBottom: 2 },
  number: { fontSize: 13, fontWeight: "bold", fontFamily: "Courier" },
  statusBadge: {
    marginTop: 4,
    padding: "2 6",
    fontSize: 9,
    backgroundColor: "#e2e8f0",
    color: "#0f172a",
  },
  panels: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  panel: {
    flex: 1,
    border: "1pt solid #cbd5e1",
    padding: 10,
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#475569",
  },
  fieldRow: { flexDirection: "row", marginBottom: 2 },
  fieldLabel: { width: 55, color: "#64748b", fontSize: 9 },
  fieldValue: { flex: 1, fontSize: 9 },
  table: { border: "1pt solid #0f172a", marginBottom: 12 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottom: "0.5pt solid #cbd5e1",
  },
  colIdx: { width: 24, textAlign: "center" },
  colDesc: { flex: 1 },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 70, textAlign: "right" },
  colAmt: { width: 80, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 220 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: { color: "#475569" },
  totalValue: { fontFamily: "Courier" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 4,
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontWeight: "bold",
  },
  note: {
    marginTop: 16,
    padding: 8,
    border: "0.5pt solid #cbd5e1",
    fontSize: 9,
    color: "#334155",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 6,
  },
});

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  ISSUED: "발행",
  SENT: "발송완료",
  CANCELLED: "취소",
};

export type InvoicePdfData = {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  note: string | null;
  supplyAmount: string;
  vatAmount: string;
  totalAmount: string;
  supplier: {
    name: string;
    businessNumber?: string;
    representative?: string;
    address?: string;
    phone?: string;
  };
  client: {
    name: string;
    code: string;
    businessNumber: string | null;
    representative: string | null;
    phone: string | null;
    address: string | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    amount: string;
  }>;
};

function fmtDate(d: Date | null): string {
  if (!d) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMoney(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document
      title={`거래명세서 ${data.invoiceNumber}`}
      author={data.supplier.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>거 래 명 세 서</Text>
            <Text style={styles.subtitle}>Invoice / Statement</Text>
          </View>
          <View style={styles.rightBlock}>
            <Text style={styles.numberLabel}>명세서 번호</Text>
            <Text style={styles.number}>{data.invoiceNumber}</Text>
            <Text style={styles.statusBadge}>
              {STATUS_LABEL[data.status] ?? data.status}
            </Text>
          </View>
        </View>

        <View style={styles.panels}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>공급자</Text>
            <Row label="상호" value={data.supplier.name} />
            <Row
              label="사업자"
              value={data.supplier.businessNumber ?? "-"}
            />
            <Row
              label="대표자"
              value={data.supplier.representative ?? "-"}
            />
            <Row label="주소" value={data.supplier.address ?? "-"} />
            <Row label="연락처" value={data.supplier.phone ?? "-"} />
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>공급받는자</Text>
            <Row
              label="상호"
              value={`${data.client.name} (${data.client.code})`}
            />
            <Row
              label="사업자"
              value={data.client.businessNumber ?? "-"}
            />
            <Row
              label="대표자"
              value={data.client.representative ?? "-"}
            />
            <Row label="주소" value={data.client.address ?? "-"} />
            <Row label="연락처" value={data.client.phone ?? "-"} />
          </View>
        </View>

        <View style={styles.panels}>
          <View style={styles.panel}>
            <Row label="발행일" value={fmtDate(data.issueDate)} />
            <Row label="지급기한" value={fmtDate(data.dueDate)} />
          </View>
          <View style={styles.panel}>
            <Row label="공급가액" value={`${fmtMoney(data.supplyAmount)} 원`} />
            <Row label="부가세(10%)" value={`${fmtMoney(data.vatAmount)} 원`} />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colIdx}>#</Text>
            <Text style={styles.colDesc}>품목</Text>
            <Text style={styles.colQty}>수량</Text>
            <Text style={styles.colUnit}>단가</Text>
            <Text style={styles.colAmt}>금액</Text>
          </View>
          {data.items.map((it, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colIdx}>{idx + 1}</Text>
              <Text style={styles.colDesc}>{it.description}</Text>
              <Text style={styles.colQty}>
                {it.quantity.toLocaleString("ko-KR")}
              </Text>
              <Text style={styles.colUnit}>{fmtMoney(it.unitPrice)}</Text>
              <Text style={styles.colAmt}>{fmtMoney(it.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>공급가액</Text>
            <Text style={styles.totalValue}>
              {fmtMoney(data.supplyAmount)} 원
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>부가세 (10%)</Text>
            <Text style={styles.totalValue}>
              {fmtMoney(data.vatAmount)} 원
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text>합계 금액</Text>
            <Text style={styles.totalValue}>
              {fmtMoney(data.totalAmount)} 원
            </Text>
          </View>
        </View>

        {data.note && (
          <View style={styles.note}>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>비고</Text>
            <Text>{data.note}</Text>
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${data.supplier.name} · ${data.invoiceNumber} · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
