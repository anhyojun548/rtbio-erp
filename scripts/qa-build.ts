/**
 * QA 테스트 가이드 빌드 — 섹션 MD 6개를 마스터 MD 로 병합 + HTML 템플릿에 주입.
 * 섹션을 수정한 뒤 `npx tsx scripts/qa-build.ts` 로 재빌드.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const dir = join(root, "docs/04-report/qa-test-guide/sections");
const order = ["0-common.md", "1-admin.md", "2-exec.md", "3-qc.md", "4-client.md", "5-ceo.md"];

const header = `# RTBIO ERP — QA 테스트 가이드 (UAT)

> 의료용품 멀티테넌트 SaaS ERP · 5개 포털 기능별 **사용자 인수 테스트(UAT)** 절차서
> 생성일 2026-06-07 · 대상 독자: 실제 업무 사용자(알티바이오 직원 · 거래처)
> 보기 좋은 HTML 버전: \`qa-test-guide.html\` (좌측 목차 + 포털 화면 미리보기 + 인쇄/PDF 저장)

이 문서는 각 포털의 **모든 기능**을 실제 사용자가 직접 클릭하며 점검할 수 있도록
\`목적 / 사전조건 / 테스트 단계 / 기대 결과 / Pass 기준\` 형식으로 정리한 절차서입니다.
\`0. 공통\` 의 로그인 계정과 크로스-포털 통합 시나리오부터 읽고 시작하세요.

---

`;

const body = order
  .map((f) => readFileSync(join(dir, f), "utf8").trim())
  .join("\n\n---\n\n");

const md = header + body + "\n";
writeFileSync(join(root, "docs/04-report/qa-test-guide.md"), md, "utf8");

// HTML 주입 (id="md"> ... </script> 사이를 교체, </script> 는 이스케이프)
const htmlPath = join(root, "docs/04-report/qa-test-guide.html");
let html = readFileSync(htmlPath, "utf8");
const safe = md.replace(/<\/script>/gi, "<\\/script>");
html = html.replace(
  /(id="md">)[\s\S]*?(<\/script>)/,
  (_m, a: string, b: string) => a + "\n" + safe + "\n" + b,
);
writeFileSync(htmlPath, html, "utf8");

const cases = body.match(/^###\s/gm)?.length ?? 0;
console.log(`마스터 MD ${md.length.toLocaleString()} bytes · 섹션 ${order.length}개 · ### 항목 ${cases}개 · HTML 주입 완료`);
