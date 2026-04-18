import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    Frame, PageTemplate, BaseDocTemplate, NextPageTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Korean fonts
font_dir = "C:/Windows/Fonts"
pdfmetrics.registerFont(TTFont("Malgun", os.path.join(font_dir, "malgun.ttf")))
pdfmetrics.registerFont(TTFont("MalgunBold", os.path.join(font_dir, "malgunbd.ttf")))
pdfmetrics.registerFontFamily("Malgun", normal="Malgun", bold="MalgunBold")

BLUE = HexColor("#2B5797")
DARK = HexColor("#1B3A5C")
GRAY = HexColor("#666666")
LIGHTGRAY = HexColor("#F2F2F2")
WHITE = HexColor("#FFFFFF")
BORDER_COLOR = HexColor("#CCCCCC")

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle("KTitle", fontName="MalgunBold", fontSize=28, textColor=BLUE, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle("KSubtitle", fontName="Malgun", fontSize=18, textColor=GRAY, alignment=TA_CENTER, spaceAfter=6))
styles.add(ParagraphStyle("KMeta", fontName="Malgun", fontSize=12, textColor=GRAY, alignment=TA_CENTER, spaceAfter=4))
styles.add(ParagraphStyle("KH1", fontName="MalgunBold", fontSize=18, textColor=DARK, spaceBefore=24, spaceAfter=12))
styles.add(ParagraphStyle("KH2", fontName="MalgunBold", fontSize=14, textColor=BLUE, spaceBefore=18, spaceAfter=8))
styles.add(ParagraphStyle("KH3", fontName="MalgunBold", fontSize=12, textColor=HexColor("#444444"), spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle("KBody", fontName="Malgun", fontSize=10, leading=16, spaceAfter=6))
styles.add(ParagraphStyle("KBullet", fontName="Malgun", fontSize=10, leading=16, leftIndent=20, bulletIndent=8, spaceAfter=4))
styles.add(ParagraphStyle("KQuote", fontName="Malgun", fontSize=10, leading=16, leftIndent=20, borderColor=BLUE, borderWidth=2, borderPadding=8, textColor=HexColor("#333333"), spaceAfter=8, italic=True))
styles.add(ParagraphStyle("KCode", fontName="Courier", fontSize=8, leading=12, leftIndent=12, spaceAfter=2, textColor=HexColor("#333333")))
styles.add(ParagraphStyle("KCheck", fontName="Malgun", fontSize=10, leading=16, leftIndent=20, bulletIndent=8, spaceAfter=4))
styles.add(ParagraphStyle("KTableHeader", fontName="MalgunBold", fontSize=9, textColor=WHITE, alignment=TA_CENTER))
styles.add(ParagraphStyle("KTableCell", fontName="Malgun", fontSize=9, leading=13))
styles.add(ParagraphStyle("KFooter", fontName="Malgun", fontSize=8, textColor=GRAY, alignment=TA_CENTER))
styles.add(ParagraphStyle("KHeader", fontName="Malgun", fontSize=8, textColor=GRAY, alignment=TA_RIGHT))

def make_table(headers, rows, col_widths=None):
    w = 170 * mm
    if col_widths is None:
        n = len(headers)
        col_widths = [w / n] * n
    else:
        total = sum(col_widths)
        col_widths = [c / total * w for c in col_widths]

    data = [[Paragraph(h, styles["KTableHeader"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, styles["KTableCell"]) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "MalgunBold"),
        ("FONTNAME", (0, 1), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHTGRAY))
    t.setStyle(TableStyle(style_cmds))
    return t

def h1(text): return Paragraph(text, styles["KH1"])
def h2(text): return Paragraph(text, styles["KH2"])
def h3(text): return Paragraph(text, styles["KH3"])
def body(text): return Paragraph(text, styles["KBody"])
def bullet(text): return Paragraph(f"\u2022 {text}", styles["KBullet"])
def quote(text): return Paragraph(f"<i>{text}</i>", styles["KQuote"])
def code(text): return Paragraph(text, styles["KCode"])
def check(text): return Paragraph(f"\u2610 {text}", styles["KCheck"])
def sp(h=6): return Spacer(1, h)

out_path = "C:/Users/user/Desktop/Project/RTBIO/docs/RTBIO_업무자동화시스템_설계문서_v1.2.pdf"

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Malgun", 8)
    canvas.setFillColor(GRAY)
    canvas.drawRightString(A4[0] - 20*mm, A4[1] - 15*mm, "RTBIO 업무 자동화 시스템 — 설계 문서 v1.2")
    canvas.drawCentredString(A4[0]/2, 15*mm, f"하마다랩스  |  Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(
    out_path, pagesize=A4,
    topMargin=25*mm, bottomMargin=25*mm, leftMargin=20*mm, rightMargin=20*mm
)

story = []

# Cover page
story.extend([
    sp(80),
    Paragraph("RTBIO", ParagraphStyle("TitleBig", parent=styles["KTitle"], fontSize=48)),
    sp(10),
    Paragraph("업무 자동화 시스템", styles["KSubtitle"]),
    Paragraph("설계 문서", ParagraphStyle("Sub2", parent=styles["KMeta"], fontSize=16)),
    sp(30),
    Paragraph("버전: v1.2", styles["KMeta"]),
    Paragraph("작성일: 2026년 4월 3일", styles["KMeta"]),
    Paragraph("작성: 하마다랩스", styles["KMeta"]),
    Paragraph("상태: 검토 중", styles["KMeta"]),
    PageBreak(),
])

# 1. 프로젝트 개요
story.extend([
    h1("1. 프로젝트 개요"),
    h2("배경"),
    body("RTBIO는 현재 발주 접수, 재고 관리, 정산, 영업 데이터 관리 등 핵심 운영 업무를 엑셀·수기 중심으로 처리하고 있다. 이로 인해 중복 입력, 오기입, 실시간 현황 파악 불가 등의 문제가 발생하고 있으며, 향후 의료기기 2등급 제품 판매 확대 시 납품 이력 및 추적 관리 요구도 증가할 것으로 예상된다."),
    h2("목표"),
    bullet("경영지원팀 수기 업무(하루 약 30건 발주 처리)를 시스템 기반으로 자동화"),
    bullet("부서별 데이터를 하나의 통합 시스템으로 관리"),
    bullet("향후 앱 확장, 의료기기 추적, 생산 연동까지 단계적으로 확장 가능한 구조 구축"),
    h2("사업적 포지셔닝"),
    body("본 시스템은 RTBIO의 업무 흐름에 100% 맞춤 설계된 <b>커스텀 ERP</b>다."),
    make_table(
        ["항목", "기존 ERP (더존, SAP 등)", "본 시스템"],
        [
            ["커스터마이징", "어렵고 비쌈", "RTBIO 업무에 100% 맞춤"],
            ["UI/UX", "복잡한 구조", "실무자 중심 단순 설계"],
            ["확장", "모듈 구매 필요", "필요 기능 직접 추가"],
            ["비용 구조", "라이선스 비용 지속 발생", "유지보수 계약으로 전환"],
        ],
        [2, 4, 4]
    ),
])

# 2. 기존 ERP 방향
story.extend([
    PageBreak(),
    h1("2. 기존 ERP 관련 방향 선택"),
    h2("옵션 A — 독립 시스템 구축 (권장)"),
    body("기존 ERP와 별도로 완전히 새로운 시스템을 구축한다. 기존 ERP의 데이터는 엑셀 내보내기를 통해 초기 마이그레이션 방식으로 이전한다."),
    body("<b>장점</b>"),
    bullet("RTBIO 업무 흐름에 100% 맞춤 설계 가능"),
    bullet("기존 ERP 구조에 종속되지 않음"),
    bullet("장기적으로 유지보수·확장이 용이"),
    bullet("운영 시스템 단일화로 담당자 혼선 제거"),
    body("<b>단점</b>"),
    bullet("초기 데이터 마이그레이션 작업 필요"),
    bullet("기존 ERP와 병행 운영 기간 발생 가능"),
    h2("옵션 B — 기존 ERP 연동형"),
    body("기존 ERP를 유지하면서 본 시스템을 프론트엔드 + 자동화 레이어로 연결한다."),
    body("<b>장점</b>"),
    bullet("기존 ERP 데이터 즉시 활용 가능"),
    bullet("전환 리스크 낮음"),
    body("<b>단점</b>"),
    bullet("기존 ERP 구조에 맞춰야 해 커스터마이징 제한"),
    bullet("두 시스템 간 데이터 정합성 관리 필요"),
    bullet("기존 ERP 벤더 의존도 유지"),
    quote("권장안: 옵션 A — 기존 ERP는 엑셀로 데이터를 내보낼 수 있어 초기 마이그레이션이 가능하다. 장기적으로 RTBIO 업무 확장성과 시스템 단일화를 고려할 때 독립 구축이 더 유리하다."),
])

# 3. 시스템 아키텍처
story.extend([
    PageBreak(),
    h1("3. 시스템 아키텍처"),
    h2("3-2. 기술 스택"),
    make_table(
        ["영역", "기술", "선택 이유"],
        [
            ["프론트엔드", "Next.js (React)", "반응형 웹, 빠른 렌더링"],
            ["백엔드 API", "NestJS (Node.js, TypeScript)", "구조적 모듈 설계, 확장성"],
            ["데이터베이스", "PostgreSQL", "관계형 데이터, RLS 보안 지원"],
            ["인증", "JWT + RBAC", "역할 기반 접근 제어"],
            ["메일 발송", "AWS SES", "대량 발송, 안정성"],
            ["파일 저장", "AWS S3", "PDF 거래명세서 저장"],
            ["AI 파싱", "AI API (벤더 미정, PIPA 검토 후)", "발주 옵션 B 선택 시만"],
            ["인프라", "AWS (컨테이너 기반)", "확장성, 보안, 가용성"],
        ],
        [2, 4, 4]
    ),
    sp(),
    h2("3-3. 설계 원칙"),
    make_table(
        ["원칙", "내용"],
        [
            ["<b>단일 데이터</b>", "모든 부서가 같은 DB 공유, 뷰/권한만 부서별 분리"],
            ["<b>RBAC 권한 관리</b>", "역할별 접근 범위 명확히 분리"],
            ["<b>API-first</b>", "향후 모바일 앱이 동일 NestJS API 재사용 가능"],
            ["<b>모듈 확장</b>", "Phase별 모듈 추가 방식으로 기능 확장"],
            ["<b>보안</b>", "HTTPS, JWT 토큰, 민감 데이터 암호화, 접근 로그"],
            ["<b>소프트 딜리트</b>", "데이터 삭제 없이 이력 보존 (의료기기 추적 대비)"],
        ],
        [3, 7]
    ),
])

# 4. 웹 vs 앱
story.extend([
    PageBreak(),
    h1("4. 웹 vs 앱 판단"),
    quote("결론: 1단계는 반응형 웹으로 구축. 앱은 2단계 이후 필요성 검토 후 결정."),
    make_table(
        ["기준", "웹 (반응형)", "네이티브 앱"],
        [
            ["경영지원팀 내부 업무", "PC 중심, 웹으로 충분", "불필요"],
            ["대리점/병원 발주", "링크 접속, 설치 불필요", "설치 거부감"],
            ["영업사원 외근 중 조회", "가능하나 경험 다소 낮음", "더 편함"],
            ["푸시 알림", "웹푸시 가능하나 제한적", "네이티브 푸시"],
            ["개발 비용", "낮음", "높음 (iOS + Android)"],
            ["배포 속도", "즉시", "앱스토어 심사 필요"],
        ],
        [3, 4, 4]
    ),
    sp(),
    h2("앱 전환 검토 시점 (Phase 2 이후)"),
    body("아래 조건 중 2개 이상 해당 시 앱 개발 착수를 권장한다."),
    bullet("영업사원이 외근 중 실시간 조회를 자주 하는가?"),
    bullet("거래처가 앱 설치를 원하는가?"),
    bullet("푸시 알림이 업무에 실질적으로 필요한가?"),
    body("1단계 웹 서비스를 API-first 구조로 설계하기 때문에, 앱 전환 시 <b>NestJS 백엔드를 그대로 재사용</b>할 수 있다."),
])

# 5. 사용자 역할 및 유저 플로우
story.extend([
    PageBreak(),
    h1("5. 사용자 역할 및 유저 플로우"),
    h2("5-1. 권한별 사용자 역할 및 데이터 소유권"),
    make_table(
        ["역할", "대상", "접근 범위"],
        [
            ["슈퍼어드민", "RTBIO 관리자", "전체 시스템"],
            ["경영지원팀", "RTBIO 내부 담당자", "발주·거래명세서·정산·마감"],
            ["품질관리팀", "RTBIO 내부 담당자", "재고 입출고·현황 대시보드"],
            ["영업부", "RTBIO 영업 직원", "거래처 매출·미수금 조회 (읽기 전용)"],
            ["외부거래처", "대리점 / 병원 담당자", "발주 입력 + 본인 거래 내역 조회"],
        ],
        [2, 3, 5]
    ),
    sp(),
    quote("데이터 소유권: 시스템 내 모든 데이터의 소유권은 RTBIO에 귀속된다. 시스템 인수인계 완료 후 슈퍼어드민 계정은 RTBIO로 이전되며, 하마다랩스는 유지보수 계약 기간 중 인프라 모니터링 및 장애 대응 목적에 한정된 별도 관리 계정을 보유한다."),
    sp(),
    h2("5-3. 발주 옵션 비교"),
    h3("옵션 A — 웹폼 직접 입력 (권장)"),
    make_table(["항목", "내용"], [["장점", "데이터 정형화, 자동화 처리 용이, 오류 최소화"], ["단점", "거래처 담당자 초기 적응 기간 필요"], ["추가 비용", "없음"]], [2, 8]),
    sp(),
    h3("옵션 B — 기존 방식 유지 + AI 파싱"),
    make_table(["항목", "내용"], [["장점", "거래처 변화 없음, 기존 방식 유지"], ["단점", "AI 파싱 정확도 한계, 수동 수정 필요 케이스 발생"], ["추가 비용", "AI API 토큰 비용 발생 (발주 건수 비례)"]], [2, 8]),
    quote("권장안: 옵션 A를 기본으로 제공한다. 옵션 B는 별도 추가 계약으로 적용한다."),
    sp(),
    h2("5-4. 배송비 자동 계산"),
    bullet("<b>기본 기준</b>: 품목군별 고정 배송비 적용"),
    bullet("<b>거래처별 면제 조건</b>: 특정 거래처에 배송비 면제 또는 별도 기준 설정 가능"),
    bullet("<b>금액 기준 면제</b>: 주문 금액 일정 기준 이상 시 배송비 자동 면제"),
    bullet("<b>설정 주체</b>: 경영지원팀 어드민 화면에서 직접 등록·수정"),
    sp(),
    h2("5-6. 정산 주기 관리"),
    make_table(
        ["정산 유형", "예시 적용 거래처"],
        [["월말 일괄 마감", "대부분의 대리점"], ["N일 후 정산 (예: 60일)", "일부 병원"], ["입금 확인 후 정산", "소규모 거래처"], ["개별 발주 건별 정산", "특수 계약 거래처"]],
        [5, 5]
    ),
])

# 6. 단계별 기능 로드맵
story.extend([
    PageBreak(),
    h1("6. 단계별 기능 로드맵"),
    quote("📌 현장 프로세스 파악 후 기능 확정 안내 — 아래 기능 목록은 현재까지 파악된 정보를 기반으로 작성한 초안(예비 프레임워크)이다. 계약 확정 후 하마다랩스 PM이 RTBIO 현장에 상주하며 각 부서 실무자와 함께 실제 업무 프로세스를 직접 파악한다. 이 과정에서 기존 엑셀·수기 업무의 세부 흐름, 예외 케이스, 현장 요구사항 등을 반영하여 기능을 재정의·추가·조정할 예정이다. Phase별 세부 기능은 현장 프로세스 파악 완료 후 최종 확정되며, 현재 명시된 항목은 변경될 수 있다."),
    sp(),
    h2("Phase 1 — 경영지원팀 자동화 (1차 계약 범위)"),
    quote("목표: 하루 30건 수기 처리 → 클릭 기반 자동 처리 / 예상 개발 기간: 별도 견적서 참조"),
    make_table(
        ["기능", "설명"],
        [
            ["거래처 관리", "대리점/병원 등록, 결제 조건·배송비 기준·예외 정책 설정"],
            ["품목 관리", "품목군별 등록, 사이즈·색상·가격 관리"],
            ["발주 접수", "발주 옵션 A(웹폼) 기본 제공, 발주 옵션 B(AI 파싱)는 추가 계약"],
            ["발주 처리", "자동 발주번호 생성, 배송비 자동 계산, 예외 정책 자동 적용"],
            ["거래명세서", "PDF 자동 생성 + 메일 자동 발송"],
            ["정산 관리", "거래처별 정산 주기 관리, 미수금 집계"],
            ["월 마감", "거래처별 원장 자동 산출, 보고서 생성"],
            ["어드민 대시보드", "신규 발주 현황, 처리 대기 목록, 미수금 요약"],
            ["권한/계정 관리", "역할별 접근 제어 (RBAC), 거래처 계정 초대 발송"],
        ],
        [3, 7]
    ),
    sp(),
    h2("Phase 2 — 품질관리팀 재고 자동화"),
    make_table(["기능", "설명"], [
        ["재고 자동 반영", "발주 확정 시 출고 재고 자동 차감"],
        ["입고 관리", "입고 등록, 이력 관리"],
        ["출고 관리", "출고 전 재고 확인, 부족 시 경고"],
        ["재고 현황 대시보드", "품목·사이즈·색상별 실시간 조회"],
        ["일별 재고 보고", "자동 집계 및 보고서 생성"],
    ], [3, 7]),
    sp(),
    h2("Phase 3 — 영업부 대시보드"),
    make_table(["기능", "설명"], [
        ["거래처별 매출 현황", "기간별 매출 조회"],
        ["미수금 현황", "거래처별 미수금 및 결제 상태"],
        ["결제 조건 조회", "거래처별 계약 조건 확인"],
        ["영업 대시보드", "영업사원별 실적 요약"],
    ], [3, 7]),
    sp(),
    h2("Phase 4 — 베트남 생산·해외 재고 연동"),
    make_table(["기능", "설명"], [
        ["생산 재고 데이터 연동", "베트남 공장 재고 업로드/연동"],
        ["원자재 소진 예측", "판매 추이 기반 부족 시점 예측"],
        ["부족 예상 알림", "임계치 도달 시 자동 알림"],
        ["생산·판매 데이터 통합 조회", "국내 재고 + 해외 생산 통합 뷰"],
    ], [3, 7]),
    sp(),
    h2("Phase 5 — 규제 대응·의료기기 추적 (장기)"),
    make_table(["기능", "설명"], [
        ["공급 내역 보고", "병원 납품 이력 자동 기록"],
        ["장비 추적 시스템", "시리얼 기반 장비 이력 관리"],
        ["유지보수 이력", "장비별 A/S 이력 관리"],
        ["UDI 대응", "의료기기 고유식별자 관리"],
    ], [3, 7]),
    quote("Phase 1 납품 후 현장 피드백을 반영하면서 Phase 2부터는 추가 계약으로 진행하는 구조를 권장한다."),
])

# 7. DB 구조
story.extend([
    PageBreak(),
    h1("7. DB 구조"),
    h2("설계 원칙"),
    bullet("<b>단일 PostgreSQL DB</b> — 모든 부서 공유, 뷰/권한으로 분리"),
    bullet("<b>도메인 단위 테이블 설계</b> — Phase별 테이블 추가 방식으로 확장"),
    bullet("<b>소프트 딜리트</b> — 데이터 삭제 없이 deleted_at 처리 (이력 보존)"),
    bullet("<b>감사 로그</b> — 주요 테이블 전체에 created_by, updated_by, created_at, updated_at 적용"),
    sp(),
    h2("Phase 1 핵심 테이블"),
    h3("인증/권한"),
    make_table(["테이블", "설명"], [["users", "계정 (내부 직원 + 외부 거래처 통합)"], ["roles", "역할 정의"], ["user_roles", "유저-역할 매핑"]], [3, 7]),
    h3("거래처"),
    make_table(["테이블", "설명"], [["partners", "대리점/병원 기본 정보"], ["partner_policies", "거래처별 결제 조건·정산 주기·예외 정책"], ["partner_contacts", "거래처 담당자 연락처"]], [3, 7]),
    h3("품목"),
    make_table(["테이블", "설명"], [["products", "품목 기본 정보 (품목군, 단가)"], ["product_variants", "사이즈·색상별 SKU"], ["shipping_rules", "품목군별 배송비 기준"]], [3, 7]),
    h3("발주"),
    make_table(["테이블", "설명"], [["orders", "발주 헤더 (발주번호, 거래처, 상태)"], ["order_items", "발주 품목 상세 (품목, 수량, 단가)"], ["order_logs", "발주 상태 변경 이력"]], [3, 7]),
    h3("정산"),
    make_table(["테이블", "설명"], [["invoices", "거래명세서 (발주 연결, PDF 경로)"], ["settlements", "정산 회차별 합산"], ["payments", "입금 기록"], ["receivables", "미수금 집계"]], [3, 7]),
])

# 8. 보안 설계
story.extend([
    PageBreak(),
    h1("8. 보안 설계"),
    make_table(
        ["항목", "방식"],
        [
            ["비밀번호", "bcrypt 해싱"],
            ["개인정보", "민감 컬럼 AES 암호화"],
            ["접근 제어", "Row-level Security (RLS) — 외부 거래처는 본인 데이터만 조회"],
            ["API 보안", "JWT 토큰 만료 관리, Refresh Token 적용"],
            ["감사 로그", "주요 데이터 변경 시 audit_logs 테이블 자동 기록"],
            ["통신", "HTTPS 필수"],
            ["백업", "일별 자동 백업, 30일 보관"],
            ["개인정보보호법", "개인정보보호법(PIPA) 준수, 개인정보 처리방침 적용"],
            ["의료기기 규제", "Phase 5 이후 식약처 관련 규제 대응 구조 확보 예정"],
        ],
        [3, 7]
    ),
])

# 9. 서비스 운영 및 지원
story.extend([
    sp(),
    h1("9. 서비스 운영 및 지원"),
    h2("인프라 운영"),
    body("시스템 인프라(서버, DB, 스토리지, 모니터링, 배포)는 <b>하마다랩스가 전담 운영</b>한다. RTBIO는 인프라를 직접 관리할 필요 없이, <b>월 구독료</b>에 아래 항목이 모두 포함된다."),
    make_table(
        ["포함 항목", "내용"],
        [
            ["AWS 인프라", "서버(컨테이너), DB, S3 스토리지, SES 메일 발송"],
            ["모니터링·배포", "서버 상태 모니터링, 장애 감지, 배포 관리"],
            ["백업", "일별 자동 백업, 30일 보관"],
            ["AI LLM 토큰 비용", "발주 옵션 B(AI 파싱) 사용 시 발생하는 AI API 토큰 비용 포함"],
        ],
        [3, 7]
    ),
    quote("RTBIO는 별도 인프라 비용 없이 월 구독료 하나로 시스템 전체를 이용할 수 있다."),
    sp(),
    h2("장애 대응 기준"),
    make_table(
        ["등급", "기준", "대응 목표 시간"],
        [
            ["긴급 (P1)", "시스템 전체 다운, 발주 처리 불가", "4시간 이내 복구 목표"],
            ["높음 (P2)", "주요 기능 일부 오작동", "1영업일 이내 대응"],
            ["일반 (P3)", "기능 개선, 비핵심 오류", "협의 후 처리"],
        ],
        [2, 5, 3]
    ),
    bullet("지원 채널: 업무 시간 내 담당자 직통 연락"),
    bullet("백업 복구: RPO 24시간, RTO 8시간"),
    bullet("<b>계약 종료 시</b>: 백업 데이터를 포함한 모든 데이터를 RTBIO에 이관하거나 요청에 따라 삭제한다."),
    sp(),
    h2("유지보수 계약 구조"),
    make_table(["항목", "포함 여부"], [
        ["버그 수정", "포함"],
        ["보안 패치", "포함"],
        ["인프라 운영", "월 구독료에 포함 (AWS + AI LLM 토큰)"],
        ["기능 개선·추가", "별도 견적"],
    ], [5, 5]),
])

# 10. 가격 및 계약
story.extend([
    PageBreak(),
    h1("10. 가격 및 계약"),
    quote("상세 가격은 별도 견적서를 참조한다."),
    make_table(
        ["항목", "방식"],
        [
            ["Phase 1 개발비", "고정 견적 (범위 기준)"],
            ["Phase 2~ 추가 기능", "Phase별 추가 계약"],
            ["월 구독료 (납품 후)", "인프라 운영 + 유지보수 + AI LLM 토큰 비용 일괄 포함"],
            ["발주 옵션 B (AI 파싱) 개발비", "별도 추가 견적 (운영 시 토큰 비용은 월 구독료에 포함)"],
        ],
        [4, 6]
    ),
])

# 11. 후속 협의 사항
story.extend([
    sp(),
    h1("11. 후속 협의 사항"),
    body("아래 항목은 계약 전 RTBIO와 추가 확인이 필요하다."),
    check("발주 방식 최종 선택 (옵션 A 단독 / 옵션 A + 옵션 B 병행)"),
    check("기존 ERP 활용 범위 및 데이터 마이그레이션 범위 확정"),
    check("기존 발주서·거래명세서·재고 엑셀·마감 자료 샘플 공유"),
    check("거래처별 결제 조건·배송비 기준·예외 정책 정리 자료 공유"),
    check("Phase 1 납기 및 계약 범위 최종 합의 (견적서 기준)"),
    check("월 구독료 금액 및 범위 최종 합의"),
])

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(f"PDF created: {out_path}")
