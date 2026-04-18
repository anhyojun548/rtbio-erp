/**
 * RTBIO ERP — Seed Script
 *
 * 알티바이오 샘플 데이터 (개인정보 없는 가상)
 * 실행: pnpm prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ----------------------------------------------------------------------------
// 상수
// ----------------------------------------------------------------------------
const TENANT_CODE = "altibio";

// ----------------------------------------------------------------------------
// 메인
// ----------------------------------------------------------------------------
async function main() {
  console.log("🌱 RTBIO ERP seed 시작...");

  // ------ 1. 테넌트 ------
  const tenant = await prisma.tenant.upsert({
    where: { code: TENANT_CODE },
    update: {},
    create: {
      code: TENANT_CODE,
      name: "알티바이오",
      subdomain: "altibio",
      active: true,
      createdBy: "seed",
    },
  });
  console.log(`✓ Tenant: ${tenant.name}`);

  // ------ 2. 사용자 (각 역할별 1~3명) ------
  const defaultPw = await bcrypt.hash("rtbio1234!", 10);
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "owner@altibio.local" },
      update: {},
      create: {
        email: "owner@altibio.local",
        password: defaultPw,
        name: "이대표",
        role: "TENANT_OWNER",
        tenantId: tenant.id,
        phone: "010-0000-0001",
        createdBy: "seed",
      },
    }),
    prisma.user.upsert({
      where: { email: "admin@altibio.local" },
      update: {},
      create: {
        email: "admin@altibio.local",
        password: defaultPw,
        name: "김경영",
        role: "ADMIN",
        tenantId: tenant.id,
        phone: "010-0000-0002",
        createdBy: "seed",
      },
    }),
    prisma.user.upsert({
      where: { email: "qc@altibio.local" },
      update: {},
      create: {
        email: "qc@altibio.local",
        password: defaultPw,
        name: "박품질",
        role: "QC",
        tenantId: tenant.id,
        phone: "010-0000-0003",
        createdBy: "seed",
      },
    }),
    prisma.user.upsert({
      where: { email: "sales1@altibio.local" },
      update: {},
      create: {
        email: "sales1@altibio.local",
        password: defaultPw,
        name: "최영업",
        role: "EXEC",
        tenantId: tenant.id,
        phone: "010-0000-0004",
        createdBy: "seed",
      },
    }),
    prisma.user.upsert({
      where: { email: "sales2@altibio.local" },
      update: {},
      create: {
        email: "sales2@altibio.local",
        password: defaultPw,
        name: "정영업",
        role: "EXEC",
        tenantId: tenant.id,
        phone: "010-0000-0005",
        createdBy: "seed",
      },
    }),
  ]);
  console.log(`✓ Users: ${users.length}명 (비밀번호: rtbio1234!)`);

  // ------ 3. 제품 마스터 (의료용품 가상) ------
  // 알티바이오 제품 카테고리 예시: 인공관절 보조재, 혈관 스텐트, 봉합사 등
  const productsData = [
    { code: "P-KNEE-01", name: "인공무릎 보조재 A", brand: "RTBIO", category: "관절", part: "무릎", basePrice: 450000, sizes: ["S", "M", "L", "XL"] },
    { code: "P-KNEE-02", name: "인공무릎 보조재 B", brand: "RTBIO", category: "관절", part: "무릎", basePrice: 520000, sizes: ["S", "M", "L"] },
    { code: "P-HIP-01",  name: "고관절 보조재",     brand: "RTBIO", category: "관절", part: "고관절", basePrice: 680000, sizes: ["M", "L", "XL"] },
    { code: "P-STEN-01", name: "혈관 스텐트 표준",  brand: "VascuMed", category: "심혈관", part: "혈관", basePrice: 890000, sizes: ["3x15", "4x18", "5x22"] },
    { code: "P-STEN-02", name: "혈관 스텐트 코팅",  brand: "VascuMed", category: "심혈관", part: "혈관", basePrice: 1120000, sizes: ["3x15", "4x18"] },
    { code: "P-SUT-01",  name: "봉합사 3-0",        brand: "RTBIO", category: "봉합", part: "연부조직", basePrice: 28000, sizes: ["30cm", "45cm", "75cm"] },
    { code: "P-SUT-02",  name: "봉합사 4-0",        brand: "RTBIO", category: "봉합", part: "연부조직", basePrice: 32000, sizes: ["30cm", "45cm"] },
    { code: "P-MESH-01", name: "탈장 메쉬",         brand: "RTBIO", category: "메쉬", part: "복부", basePrice: 190000, sizes: ["10x15", "15x20", "20x30"] },
    { code: "P-BONE-01", name: "골 이식재",         brand: "OrthoCo", category: "정형", part: "골조직", basePrice: 340000, sizes: ["1cc", "2.5cc", "5cc"] },
    { code: "P-CATH-01", name: "카테터 표준",       brand: "VascuMed", category: "심혈관", part: "혈관", basePrice: 75000, sizes: ["Fr5", "Fr6", "Fr7"] },
  ];

  for (const pd of productsData) {
    const product = await prisma.product.upsert({
      where: { code: pd.code },
      update: {},
      create: {
        code: pd.code,
        name: pd.name,
        brand: pd.brand,
        category: pd.category,
        part: pd.part,
        basePrice: pd.basePrice,
        expiryMonths: 36, // 기본 36개월
        createdBy: "seed",
        sizes: {
          create: pd.sizes.map((sizeCode) => {
            const base = 50 + Math.floor(Math.random() * 100);
            return {
              sizeCode,
              physicalStock: base,
              availableStock: base,
              reorderPoint: 20,
              createdBy: "seed",
            };
          }),
        },
      },
    });
  }
  console.log(`✓ Products: ${productsData.length}종 (사이즈 포함)`);

  // ------ 4. 거래처 (대리점 + 병원 + 기타) ------
  const clientsData = [
    { code: "C-AGEN-001", name: "서울메디칼 대리점", type: "AGENCY" as const, businessNumber: "123-45-67890", representative: "김대표", phone: "02-000-0001", address: "서울 강남구", paymentTerms: "월말 25일 발주, 익월 말 입금" },
    { code: "C-AGEN-002", name: "부산의료기 대리점", type: "AGENCY" as const, businessNumber: "234-56-78901", representative: "이대표", phone: "051-000-0002", address: "부산 해운대구", paymentTerms: "월말 25일 발주, 익월 말 입금" },
    { code: "C-AGEN-003", name: "대전메드 대리점",  type: "AGENCY" as const, businessNumber: "345-67-89012", representative: "박대표", phone: "042-000-0003", address: "대전 유성구", paymentTerms: "월말 25일 발주, 익월 말 입금" },
    { code: "C-HOSP-001", name: "서울대병원",       type: "HOSPITAL" as const, businessNumber: "111-22-33444", representative: "원장", phone: "02-000-1001", address: "서울 종로구", paymentTerms: "현금" },
    { code: "C-HOSP-002", name: "강남성모병원",     type: "HOSPITAL" as const, businessNumber: "222-33-44555", representative: "원장", phone: "02-000-1002", address: "서울 서초구", paymentTerms: "카드 60일" },
    { code: "C-HOSP-003", name: "부산백병원",       type: "HOSPITAL" as const, businessNumber: "333-44-55666", representative: "원장", phone: "051-000-1003", address: "부산 부산진구", paymentTerms: "카드 30일" },
    { code: "C-HOSP-004", name: "광주메디컬센터",   type: "HOSPITAL" as const, businessNumber: "444-55-66777", representative: "원장", phone: "062-000-1004", address: "광주 동구", paymentTerms: "현금" },
    { code: "C-HOSP-005", name: "대구가톨릭병원",   type: "HOSPITAL" as const, businessNumber: "555-66-77888", representative: "원장", phone: "053-000-1005", address: "대구 남구", paymentTerms: "카드 60일" },
    { code: "C-OTHER-01", name: "한국의료기협회",   type: "OTHER" as const, businessNumber: "666-77-88999", representative: "회장", phone: "02-000-2001", address: "서울 영등포구", paymentTerms: "사안별" },
  ];

  const salesReps = users.filter((u) => u.role === "EXEC");
  for (const [i, cd] of clientsData.entries()) {
    await prisma.client.upsert({
      where: { code: cd.code },
      update: {},
      create: {
        ...cd,
        email: `${cd.code.toLowerCase()}@sample.local`,
        salesRepId: salesReps[i % salesReps.length]?.id,
        createdBy: "seed",
      },
    });
  }
  console.log(`✓ Clients: ${clientsData.length}곳`);

  // ------ 5. 거래처 할인율 (R02) ------
  // 대리점은 카테고리별 할인 10~20%, 병원은 할인 없거나 소폭
  const clients = await prisma.client.findMany();
  const categories = ["관절", "심혈관", "봉합", "메쉬", "정형"];

  for (const client of clients) {
    for (const cat of categories) {
      let rate = 0;
      if (client.type === "AGENCY") rate = 0.15;
      else if (client.type === "HOSPITAL") rate = 0.05;
      if (rate > 0) {
        await prisma.clientDiscount.upsert({
          where: { clientId_category: { clientId: client.id, category: cat } },
          update: {},
          create: {
            clientId: client.id,
            category: cat,
            discountRate: rate,
            createdBy: "seed",
          },
        });
      }
    }
  }
  console.log(`✓ ClientDiscounts: ${clients.length}×${categories.length}개 (대리점 15% / 병원 5%)`);

  // ------ 6. 거래처 고정가 (R02, 최상위 우선순위) ------
  // 특정 병원에 특정 제품 고정가 (예: 대형병원 VIP 계약)
  const hospital1 = clients.find((c) => c.code === "C-HOSP-001");
  const products = await prisma.product.findMany();
  const kneeA = products.find((p) => p.code === "P-KNEE-01");
  if (hospital1 && kneeA) {
    await prisma.clientFixedPrice.upsert({
      where: { clientId_productId: { clientId: hospital1.id, productId: kneeA.id } },
      update: {},
      create: {
        clientId: hospital1.id,
        productId: kneeA.id,
        fixedPrice: 400000, // 특별가
        createdBy: "seed",
      },
    });
    console.log(`✓ ClientFixedPrice: 서울대병원 × 인공무릎 A = 400,000원`);
  }

  // ------ 7. 칸반 단계 (R05) ------
  const kanbanStages = [
    { key: "RECEIVED",  label: "접수대기", sortOrder: 1, color: "#fbbf24" },
    { key: "PICKING",   label: "피킹",     sortOrder: 2, color: "#60a5fa" },
    { key: "INSPECT",   label: "검수",     sortOrder: 3, color: "#a78bfa" },
    { key: "PACKING",   label: "포장",     sortOrder: 4, color: "#f472b6" },
    { key: "READY",     label: "출고대기", sortOrder: 5, color: "#34d399" },
    { key: "COMPLETED", label: "출고완료", sortOrder: 6, color: "#22c55e", isTerminal: true },
  ];
  for (const ks of kanbanStages) {
    await prisma.kanbanColumn.upsert({
      where: { key: ks.key },
      update: {},
      create: { ...ks, createdBy: "seed" },
    });
  }
  console.log(`✓ KanbanColumns: ${kanbanStages.length}단계`);

  // ------ 8. 테넌트 설정 (R13) ------
  const tenantSettings = [
    { key: "business_hour_start", value: "09:00", description: "업무 시작 시각" },
    { key: "business_hour_end",   value: "18:00", description: "업무 종료 시각" },
    { key: "shipping_cutoff",     value: "15:30", description: "택배 마감시간 (이후 주문은 익일 출고)" },
    { key: "reorder_multiplier",  value: "2.5",   description: "재고 알람 기준 = 월평균 × 값" },
    { key: "vat_rate",            value: "0.10",  description: "부가세율 (R18)" },
  ];
  for (const ts of tenantSettings) {
    await prisma.tenantSetting.upsert({
      where: { key: ts.key },
      update: {},
      create: { ...ts, updatedBy: "seed" },
    });
  }
  console.log(`✓ TenantSettings: ${tenantSettings.length}건`);

  // ------ 9. 영업 배정 (R11, R23) ------
  for (const [i, client] of clients.entries()) {
    const rep = salesReps[i % salesReps.length];
    if (rep) {
      await prisma.salesAssignment.upsert({
        where: { clientId_salesRepId: { clientId: client.id, salesRepId: rep.id } },
        update: {},
        create: {
          clientId: client.id,
          salesRepId: rep.id,
          createdBy: "seed",
        },
      });
    }
  }
  console.log(`✓ SalesAssignments: ${clients.length}건`);

  // ------ 10. 학회 샘플 (R23) ------
  const conf = await prisma.conference.create({
    data: {
      name: "2026 대한정형외과학회",
      location: "코엑스",
      startDate: new Date("2026-05-15"),
      endDate: new Date("2026-05-17"),
      note: "학회 부스 운영 — 영업팀 전원 배정",
      createdBy: "seed",
      visitors: {
        create: [
          { name: "김의사", phone: "010-1111-1001", affiliation: "부산대병원", contactStatus: "신규", createdBy: "seed" },
          { name: "이의사", phone: "010-1111-1002", affiliation: "고려대병원", contactStatus: "접촉중", createdBy: "seed" },
          { name: "박의사", phone: "010-1111-1003", affiliation: "연세대병원", contactStatus: "신규", createdBy: "seed" },
        ],
      },
    },
  });
  console.log(`✓ Conference: ${conf.name} (방문자 3명)`);

  console.log("\n🌱 Seed 완료!");
  console.log("로그인 테스트 계정:");
  console.log("  owner@altibio.local / admin@altibio.local / qc@altibio.local");
  console.log("  sales1@altibio.local / sales2@altibio.local");
  console.log("  모두 비밀번호: rtbio1234!");
}

main()
  .catch((e) => {
    console.error("❌ Seed 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
