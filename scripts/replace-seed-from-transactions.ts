/**
 * 41K TransactionLedger 에서 unique 거래처/제품 추출 후 DB 시드 교체.
 *
 * 동작:
 * - 기존 Client (mock 시드) → active=false (DELETE 아님, 외래키 안전)
 * - TransactionLedger 의 unique (clientCode, clientName) → Client 신규 upsert
 *   · code = "C-{clientCode}" (대문자 정규화)
 *   · type: clientName 에 '병원|의원|정형|재활|클리닉|메디컬센터' → HOSPITAL, 그 외 AGENCY
 * - 기존 Product (mock 시드) → active=false
 * - TransactionLedger 의 unique (productCode, productName) → Product 신규 upsert
 *   · code = productCode (특수문자 정규화, max 32자)
 *   · category = productName 의 첫 단어 (공백/괄호 기준)
 *   · basePrice = 평균 unitPrice
 *   · 기본 사이즈 'STD' 1개 생성
 *
 * 안전 장치:
 * - 기존 레코드는 UPDATE active=false (DELETE 없음)
 * - upsert 패턴으로 idempotent
 * - clientCode / productCode 가 null 인 행은 skip
 *
 * 실행: pnpm tsx scripts/replace-seed-from-transactions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 거래처명에서 HOSPITAL 여부 판단 */
function inferClientType(name: string): "HOSPITAL" | "AGENCY" {
  if (/병원|의원|정형|재활|클리닉|메디컬센터/.test(name)) return "HOSPITAL";
  return "AGENCY";
}

/** productCode 를 안전한 unique code 로 변환 (max 32자) */
function normalizeProductCode(raw: string): string {
  return raw
    .replace(/[()]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .slice(0, 32);
}

async function main() {
  console.log("=== replace-seed-from-transactions 시작 ===\n");

  // 1. Tenant 확인
  const tenant = await prisma.tenant.findFirst({ where: { code: "altibio" } });
  if (!tenant) throw new Error("Tenant 'altibio' not found — DB 초기화 먼저 실행");
  console.log(`Tenant: ${tenant.name} (${tenant.id})\n`);

  // ─────────────────────────────────────────────────
  // STEP A: 거래처 (Client)
  // ─────────────────────────────────────────────────

  // A1. TransactionLedger 에서 unique (clientCode, clientName) 추출
  const clientRows = await prisma.transactionLedger.groupBy({
    by: ["clientCode", "clientName"],
    where: {
      clientCode: { not: null },
      clientName: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
  });
  console.log(`[A1] TransactionLedger unique 거래처: ${clientRows.length}개`);

  // A2. 기존 시드 거래처 비활성화
  const oldClientCount = await prisma.client.count();
  await prisma.client.updateMany({ where: {}, data: { active: false } });
  console.log(`[A2] 기존 거래처 ${oldClientCount}개 → active=false`);

  // A3. 실제 거래처 upsert
  let newClients = 0;
  let updatedClients = 0;
  let skippedClients = 0;
  const hospitalCodes: string[] = [];
  const agencyCodes: string[] = [];

  for (const row of clientRows) {
    if (!row.clientCode || !row.clientName) {
      skippedClients++;
      continue;
    }
    const code = `C-${row.clientCode.toUpperCase()}`;
    const name = row.clientName;
    const type = inferClientType(name);

    const existing = await prisma.client.findUnique({ where: { code } });
    if (existing) {
      await prisma.client.update({
        where: { code },
        data: { name, type, active: true },
      });
      updatedClients++;
    } else {
      await prisma.client.create({
        data: {
          code,
          name,
          type,
          active: true,
          createdBy: "replace-seed-from-transactions",
        },
      });
      newClients++;
    }

    if (type === "HOSPITAL") hospitalCodes.push(code);
    else agencyCodes.push(code);
  }
  const totalActiveClients = await prisma.client.count({ where: { active: true } });
  console.log(`[A3] 거래처 upsert 완료:`);
  console.log(`     신규=${newClients}, 업데이트=${updatedClients}, skip=${skippedClients}`);
  console.log(`     HOSPITAL=${hospitalCodes.length}, AGENCY=${agencyCodes.length}`);
  console.log(`     활성 거래처 총계: ${totalActiveClients}개\n`);

  // ─────────────────────────────────────────────────
  // STEP B: 제품 (Product)
  // ─────────────────────────────────────────────────

  // B1. TransactionLedger 에서 unique (productCode, productName) + 평균 unitPrice 추출
  const productRows = await prisma.transactionLedger.groupBy({
    by: ["productCode", "productName"],
    where: {
      productCode: { not: null },
      productName: { not: "" },
    },
    _avg: { unitPrice: true },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
  });
  console.log(`[B1] TransactionLedger unique 제품: ${productRows.length}개`);

  // B2. 기존 시드 제품 비활성화
  const oldProductCount = await prisma.product.count();
  await prisma.product.updateMany({ where: {}, data: { active: false } });
  console.log(`[B2] 기존 제품 ${oldProductCount}개 → active=false`);

  // B3. 실제 제품 upsert
  let newProducts = 0;
  let updatedProducts = 0;
  let skippedProducts = 0;
  const codeCollisionMap = new Map<string, number>(); // 정규화 후 중복 처리

  for (const row of productRows) {
    if (!row.productCode || !row.productName) {
      skippedProducts++;
      continue;
    }
    let code = normalizeProductCode(row.productCode);

    // 정규화 후 충돌 방지
    if (codeCollisionMap.has(code)) {
      const cnt = codeCollisionMap.get(code)! + 1;
      codeCollisionMap.set(code, cnt);
      code = `${code.slice(0, 29)}-${cnt}`;
    } else {
      codeCollisionMap.set(code, 1);
    }

    const name = row.productName;
    // category = 첫 단어 (공백/괄호/슬래시 기준)
    const category = name.split(/[\s(/]/)[0] || "기타";
    const basePrice = row._avg.unitPrice ? Math.round(Number(row._avg.unitPrice)) : 0;

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      await prisma.product.update({
        where: { code },
        data: { name, category, basePrice, active: true },
      });
      updatedProducts++;
    } else {
      await prisma.product.create({
        data: {
          code,
          name,
          category,
          brand: "RTBIO",
          basePrice,
          active: true,
          createdBy: "replace-seed-from-transactions",
          sizes: {
            create: [
              {
                sizeCode: "STD",
                physicalStock: 0,
                availableStock: 0,
                reorderPoint: 0,
                createdBy: "replace-seed-from-transactions",
              },
            ],
          },
        },
      });
      newProducts++;
    }
  }

  const totalActiveProducts = await prisma.product.count({ where: { active: true } });
  console.log(`[B3] 제품 upsert 완료:`);
  console.log(`     신규=${newProducts}, 업데이트=${updatedProducts}, skip=${skippedProducts}`);
  console.log(`     활성 제품 총계: ${totalActiveProducts}개\n`);

  // ─────────────────────────────────────────────────
  // STEP C: 최종 검증
  // ─────────────────────────────────────────────────
  const finalClients = await prisma.client.count({ where: { active: true } });
  const finalHospital = await prisma.client.count({ where: { active: true, type: "HOSPITAL" } });
  const finalAgency = await prisma.client.count({ where: { active: true, type: "AGENCY" } });
  const finalProducts = await prisma.product.count({ where: { active: true } });

  console.log("=== 최종 결과 ===");
  console.log(`활성 거래처: ${finalClients}개 (HOSPITAL=${finalHospital}, AGENCY=${finalAgency})`);
  console.log(`활성 제품:   ${finalProducts}개`);
  console.log("\n완료.");
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
