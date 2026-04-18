/**
 * RTBIO 견적서 · 과업명세서 — 단일 HTML + DOCX 빌드 스크립트
 *
 * Usage:
 *   node build-견적서.js
 *
 * Output:
 *   - RTBIO_견적서_v1.0_standalone.html  (로고 base64 임베딩)
 *   - RTBIO_견적서_v1.0.docx             (Word 문서)
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, ImageRun, PageBreak
} = require("docx");

const DIR = __dirname;

// ─── 1. Standalone HTML ─────────────────────────────────────────

function buildStandaloneHtml() {
  let html = fs.readFileSync(path.join(DIR, "RTBIO_견적서_v1.0.html"), "utf-8");
  const logoPath = path.join(DIR, "..", "proposal", "hamada-logo.png");
  const logoB64 = fs.readFileSync(logoPath).toString("base64");
  const dataUri = `data:image/png;base64,${logoB64}`;
  html = html.replace(/"\.\.\/proposal\/hamada-logo\.png"/g, `"${dataUri}"`);
  const outPath = path.join(DIR, "RTBIO_견적서_v1.0_standalone.html");
  fs.writeFileSync(outPath, html, "utf-8");
  console.log(`✓ Standalone HTML → ${outPath}`);
}

// ─── 2. DOCX ────────────────────────────────────────────────────

const PAGE_WIDTH = 12240;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

const PRIMARY = "1B3A5C";
const ACCENT = "00A8B5";
const GRAY = "6B7280";
const LIGHT_BG = "F8F9FB";
const WHITE = "FFFFFF";

function hCell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill: PRIMARY, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: WHITE, font: "맑은 고딕", size: 20 })]
    })]
  });
}

function tCell(text, width, opts = {}) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "맑은 고딕", size: 20, color: opts.color || "1A1A2E" }));
    } else {
      runs.push(new TextRun({ text: part, font: "맑은 고딕", size: 20, color: opts.color || GRAY }));
    }
  }
  return new TableCell({
    borders: opts.noBorder ? noBorders : borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading || undefined,
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: runs })]
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, bold: true, font: "맑은 고딕", size: level === HeadingLevel.HEADING_1 ? 28 : level === HeadingLevel.HEADING_2 ? 24 : 20, color: PRIMARY })]
  });
}

function label(text) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, font: "맑은 고딕", size: 18, color: ACCENT })]
  });
}

function para(text, opts = {}) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "맑은 고딕", size: 20, color: "1A1A2E" }));
    } else {
      runs.push(new TextRun({ text: part, font: "맑은 고딕", size: 20, color: opts.color || GRAY }));
    }
  }
  return new Paragraph({ spacing: { before: 60, after: 60 }, children: runs });
}

function spacer() {
  return new Paragraph({ spacing: { before: 120, after: 120 }, children: [] });
}

function divider() {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" } },
    children: [new TextRun({ text: " ", size: 4 })]
  });
}

function metaTable(rows) {
  return new Table({
    width: { size: CONTENT_WIDTH / 2 - 100, type: WidthType.DXA },
    rows: rows.map(([l, v]) => new TableRow({
      children: [
        tCell(l, 1800, { noBorder: true, color: GRAY }),
        tCell(`**${v}**`, 2800, { noBorder: true }),
      ]
    }))
  });
}

async function buildDocx() {
  const logoPath = path.join(DIR, "..", "proposal", "hamada-logo.png");
  const logoData = fs.readFileSync(logoPath);

  const sections = [];

  // ── Title page header ──
  const titleChildren = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 }, children: [
      new ImageRun({ data: logoData, transformation: { width: 160, height: 50 }, type: "png" })
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
      new TextRun({ text: "견적서 · 과업명세서", bold: true, font: "맑은 고딕", size: 40, color: PRIMARY })
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [
      new TextRun({ text: "RTBIO 업무 자동화 시스템", font: "맑은 고딕", size: 22, color: GRAY })
    ]}),
    divider(),
    spacer(),
  ];

  // ── Meta info ──
  titleChildren.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA }, margins: cellMargins, children: [
            new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "공급자", bold: true, font: "맑은 고딕", size: 18, color: ACCENT })] }),
            para("상호: **하마다랩스**"),
            para("대표: **방승애**"),
            para("연락처: **010-8888-0180**"),
            para("이메일: **victoria@hamadalabs.com**"),
          ]}),
          new TableCell({ borders: noBorders, width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA }, margins: cellMargins, children: [
            new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "수신", bold: true, font: "맑은 고딕", size: 18, color: ACCENT })] }),
            para("상호: **알티바이오**"),
            para("견적일: **2026년 4월 10일**"),
            para("유효기간: **발행일로부터 30일**"),
          ]}),
        ]})
      ]
    }),
    spacer(),
    divider(),
  );

  // ── 1. 프로젝트 개요 ──
  titleChildren.push(
    label("PROJECT OVERVIEW"),
    heading("프로젝트 개요", HeadingLevel.HEADING_2),
    para("현재 카카오톡 발주 접수 → 얼마에요 수기 입력 → 엑셀 마감 처리로 운영되는 **RTBIO의 전체 업무 프로세스**를 웹 기반 통합 시스템으로 전환합니다. 발주 접수부터 거래명세서 발행, 재고 관리, 월 마감 정산까지 **수기 작업을 제거**하고 자동화하는 것이 핵심 목표입니다."),
    para("거래처는 **웹 발주폼**으로 직접 주문하고, 내부 팀은 **부서별 전용 대시보드**에서 발주 확인 · 출고 · 정산 · 재고를 통합 관리합니다. 기존 얼마에요 데이터(약 3년치)를 신규 시스템으로 이관하여 **완전한 ERP 전환**을 진행합니다."),
    divider(),
  );

  // ── 2. 제공 범위 ──
  titleChildren.push(
    label("SCOPE OF WORK"),
    heading("제공 범위", HeadingLevel.HEADING_2),
    para("1차~3차를 통합 진행하여 **2개월 이내**에 전체 시스템을 구축합니다."),
    spacer(),
  );

  // Phase 1
  titleChildren.push(
    heading("1차 — 경영지원팀 자동화", HeadingLevel.HEADING_3),
    para("메인 시스템 + DB 인프라 구축 포함. 하루 30건 수기 입력을 클릭 기반 자동 처리로 전환."),
    para("**포함 기능:** 거래처 발주 포털 · 거래처 관리 · 품목 관리 · 발주 접수/처리 · 거래명세서 자동 발행 · 정산 관리 · 월 마감 · UDI 관리 · 권한/계정 관리"),
    spacer(),
  );

  // Phase 2
  titleChildren.push(
    heading("2차 — 품질관리팀 재고 자동화", HeadingLevel.HEADING_3),
    para("발주 확정 시 재고 자동 차감, 입출고 관리, 부족 시 경고, 실시간 재고 대시보드."),
    para("**포함 기능:** 재고 자동 반영 · 입고 관리 · 출고 관리 · 재고 현황 대시보드 · 일별 재고 보고 · 담당자 배정 · 작업 상태 관리 · 샘플/미팅 출고"),
    spacer(),
  );

  // Phase 3
  titleChildren.push(
    heading("3차 — 영업부 대시보드", HeadingLevel.HEADING_3),
    para("영업사원이 거래처별 매출·미수금·실적을 직접 조회하는 권한 분리형 대시보드."),
    para("**포함 기능:** 거래처별 매출 현황 · 미수금 현황 · 결제 조건 조회 · 영업 대시보드 · 사용량 입력 · 기간별 매출 보고서"),
    divider(),
  );

  // ── 3. 가격 옵션 ──
  titleChildren.push(
    label("PRICING"),
    heading("가격 옵션", HeadingLevel.HEADING_2),
    para("두 가지 결제 방식 중 선택하실 수 있습니다. 모든 옵션은 **동일한 기능과 품질**을 제공합니다."),
    spacer(),
  );

  // Option A
  titleChildren.push(
    heading("Option A — 일시불 모델", HeadingLevel.HEADING_3),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [hCell("항목", 4000), hCell("금액", 5360)] }),
        new TableRow({ children: [tCell("착수금 (계약 시)", 4000), tCell("**1,000만원**", 5360)] }),
        new TableRow({ children: [tCell("잔금 (최종 납품 시)", 4000), tCell("**1,000만원**", 5360)] }),
        new TableRow({ children: [
          tCell("**개발비 합계**", 4000, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } }),
          tCell("**2,000만원**", 5360, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } })
        ] }),
        new TableRow({ children: [tCell("무상 유지보수", 4000), tCell("**3개월**", 5360)] }),
        new TableRow({ children: [tCell("이후 인프라 + 유지보수", 4000), tCell("**월 20만원**", 5360)] }),
      ]
    }),
    spacer(),
  );

  // Option B
  titleChildren.push(
    heading("Option B — 구독형 모델 (36개월)", HeadingLevel.HEADING_3),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [hCell("항목", 4000), hCell("금액", 5360)] }),
        new TableRow({ children: [tCell("착수금 (계약 시)", 4000), tCell("**500만원**", 5360)] }),
        new TableRow({ children: [tCell("잔금 (1차 납품 시)", 4000), tCell("**500만원**", 5360)] }),
        new TableRow({ children: [
          tCell("**초기 개발비 합계**", 4000, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } }),
          tCell("**1,000만원**", 5360, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } })
        ] }),
        new TableRow({ children: [tCell("월 구독료 (인프라+유지보수+업데이트)", 4000), tCell("**월 58만원**", 5360)] }),
        new TableRow({ children: [tCell("구독 기간", 4000), tCell("**36개월**", 5360)] }),
        new TableRow({ children: [tCell("구독료 소계", 4000), tCell("**2,088만원**", 5360)] }),
        new TableRow({ children: [
          tCell("**36개월 총 비용**", 4000, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } }),
          tCell("**3,088만원**", 5360, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } })
        ] }),
      ]
    }),
    spacer(),
  );

  // AI Note
  titleChildren.push(
    new Paragraph({
      spacing: { before: 100, after: 60 },
      shading: { fill: "FFF3E0", type: ShadingType.CLEAR },
      children: [new TextRun({ text: "AI/LLM 사용료 안내 (양쪽 옵션 공통)", bold: true, font: "맑은 고딕", size: 20, color: "F57C00" })]
    }),
    new Paragraph({
      spacing: { before: 40, after: 100 },
      shading: { fill: "FFF3E0", type: ShadingType.CLEAR },
      children: [new TextRun({ text: "본 시스템은 AI 기능(자동 분류, 수요 예측 등)을 포함하며, LLM API 사용료가 별도 발생합니다. 예상 월 비용은 약 5만원이며, 1차 납품 후 실제 사용량을 측정하여 정확한 금액을 안내드립니다. AI 사용료는 실비 기준으로 별도 청구됩니다.", font: "맑은 고딕", size: 20, color: GRAY })]
    }),
    divider(),
  );

  // ── 4. 옵션 비교표 ──
  titleChildren.push(
    label("COMPARISON"),
    heading("옵션 상세 비교", HeadingLevel.HEADING_2),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [hCell("항목", 2800), hCell("Option A (일시불)", 3280), hCell("Option B (구독형)", 3280)] }),
        new TableRow({ children: [tCell("초기 비용", 2800), tCell("2,000만원", 3280), tCell("**1,000만원**", 3280)] }),
        new TableRow({ children: [tCell("결제 방식", 2800), tCell("착수금 1,000 + 잔금 1,000", 3280), tCell("착수금 500 + 잔금 500", 3280)] }),
        new TableRow({ children: [tCell("월 비용 (AI 제외)", 2800), tCell("20만원 (4개월차부터)", 3280), tCell("58만원 (납품 직후부터)", 3280)] }),
        new TableRow({ children: [tCell("AI 사용료", 2800), tCell("실비 별도", 3280), tCell("실비 별도", 3280)] }),
        new TableRow({ children: [tCell("무상 유지보수", 2800), tCell("3개월", 3280), tCell("구독 기간 전체", 3280)] }),
        new TableRow({ children: [tCell("약정 기간", 2800), tCell("없음", 3280), tCell("36개월", 3280)] }),
        new TableRow({ children: [tCell("기능 업데이트", 2800), tCell("별도 견적", 3280), tCell("구독 기간 내 포함", 3280)] }),
        new TableRow({ children: [
          tCell("**36개월 총 비용**", 2800, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } }),
          tCell("**약 2,660만원**", 3280, { shading: { fill: LIGHT_BG, type: ShadingType.CLEAR } }),
        ] }),
      ]
    }),
    divider(),
  );

  // ── 5. 개발 일정 ──
  titleChildren.push(
    label("TIMELINE"),
    heading("개발 일정", HeadingLevel.HEADING_2),
    para("1~3차 통합 진행으로 **착수일로부터 8주(약 2개월) 이내**에 전체 시스템을 납품합니다."),
    spacer(),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [hCell("기간", 2000), hCell("단계", 2360), hCell("주요 내용", 5000)] }),
        new TableRow({ children: [tCell("Week 1~3", 2000), tCell("**1차 개발**", 2360), tCell("경영지원팀 자동화 · 거래처 발주 포털 · DB 인프라 구축", 5000)] }),
        new TableRow({ children: [tCell("Week 4~5", 2000), tCell("**2차 개발**", 2360), tCell("품질관리팀 재고 · 입출고 관리 · 작업 상태 관리", 5000)] }),
        new TableRow({ children: [tCell("Week 6~7", 2000), tCell("**3차 개발**", 2360), tCell("영업부 대시보드 · 매출/미수금 조회 · 보고서 자동화", 5000)] }),
        new TableRow({ children: [tCell("Week 8", 2000), tCell("**통합 테스트**", 2360), tCell("QA 및 버그 수정 · 데이터 이관 · 배포 및 교육", 5000)] }),
      ]
    }),
    divider(),
  );

  // ── 6. 계약 조건 ──
  titleChildren.push(
    label("TERMS"),
    heading("계약 조건", HeadingLevel.HEADING_2),
  );

  const terms = [
    ["개발 범위", "상기 제공 범위(1~3차)를 기본 골격으로 하며, 세부 기능은 **2차 미팅 완료 후 최종 확정**합니다. 확정 범위 내 자잘한 기능 조정은 **무상으로 반영**하되, 신규 모듈 등 대규모 기능 추가는 **별도 견적**으로 진행합니다."],
    ["납품 기준", "각 단계별 기능 완성 및 RTBIO 담당자 **테스트 확인 후 납품 완료** 처리."],
    ["데이터 이관", "얼마에요 엑셀 내보내기 데이터(약 3년치)를 신규 시스템 DB로 이관. **이관 비용은 개발비에 포함.**"],
    ["유지보수", "Option A: 최종 납품 후 **3개월 무상**, 이후 월 운영비 별도 계약. / Option B: **36개월 구독 기간 내 유지보수 포함.**"],
    ["소유권", "Option A: 개발비 완납 시 **소스코드 및 시스템 소유권 이전.** / Option B: 구독 기간 중 **사용권 부여**, 36개월 완료 후 소유권 이전."],
    ["기밀유지", "양사의 업무상 취득한 정보에 대해 **상호 기밀유지 의무** 적용. 제3자 제공 불가."],
    ["해지 조건", "Option B 중도 해지 시 **잔여 구독료의 30%**를 위약금으로 정산. 기 납부 개발비는 반환하지 않음."],
    ["인프라 환경", "클라우드 기반(AWS/Vercel) 웹 서비스. 앱 설치 없이 **모바일 반응형 웹**으로 운영."],
  ];

  titleChildren.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      rows: terms.map(([l, v], i) => new TableRow({
        children: [
          tCell(`**${l}**`, 2200, { shading: i % 2 === 0 ? { fill: LIGHT_BG, type: ShadingType.CLEAR } : undefined }),
          tCell(v, 7160, { shading: i % 2 === 0 ? { fill: LIGHT_BG, type: ShadingType.CLEAR } : undefined }),
        ]
      }))
    }),
  );

  // ── Footer ──
  titleChildren.push(
    spacer(),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "© 2026 HAMADA LABS. All rights reserved.", font: "맑은 고딕", size: 16, color: "9CA3AF" })]
    }),
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        }
      },
      children: titleChildren
    }]
  });

  const outPath = path.join(DIR, "RTBIO_견적서_v1.0.docx");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ DOCX → ${outPath}`);
}

// ── Run ──
async function main() {
  buildStandaloneHtml();
  await buildDocx();
  console.log("\nDone!");
}

main().catch(err => { console.error(err); process.exit(1); });
