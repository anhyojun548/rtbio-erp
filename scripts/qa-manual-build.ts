/**
 * 사용 설명서 빌드 — 섹션 MD 6개 병합 + 각 포털 제목 뒤에 대시보드 캡처 삽입 + HTML 주입.
 * 섹션 수정 후 `npx tsx scripts/qa-manual-build.ts` 로 재빌드.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const dir = join(root, "docs/04-report/user-manual/sections");
const order = ["0-common.md", "1-admin.md", "2-exec.md", "3-qc.md", "4-client.md", "5-ceo.md"];

const header = `# RTBIO ERP — 사용 설명서

> 의료용품 멀티테넌트 SaaS ERP · 5개 포털 **메뉴·기능·버튼 사용법** 안내서
> 생성일 2026-06-07 · 대상 독자: 실제 업무 사용자(알티바이오 직원 · 거래처)
> 보기 좋은 HTML 버전: \`user-manual.html\` (좌측 목차 + 화면 캡처 + 인쇄/PDF 저장)

이 문서는 각 포털의 화면을 **메뉴 순서대로**, 실제 사용 시나리오(이야기) 형태로 설명합니다.
처음 사용하신다면 \`0. 시작하기\` 의 로그인 방법과 공통 화면 요소부터 읽어 보세요.

---

`;

let body = order
  .map((f) => readFileSync(join(dir, f), "utf8").trim())
  .join("\n\n---\n\n");

// 각 포털 최상위 제목 뒤에 해당 포털 대시보드 캡처 삽입
const IMG_BY_NUM: Record<string, string> = {
  "1": "admin",
  "2": "exec",
  "3": "qc",
  "4": "client",
  "5": "ceo",
};
const LABEL_BY_NUM: Record<string, string> = {
  "1": "경영지원",
  "2": "영업",
  "3": "품질관리",
  "4": "거래처",
  "5": "대표",
};
body = body.replace(/^(##\s*([1-5])\.[^\n]*포털[^\n]*)$/gm, (full, line, num) => {
  const key = IMG_BY_NUM[num];
  if (!key) return full;
  return `${line}\n\n![${LABEL_BY_NUM[num]} 포털 대시보드 화면](qa-test-guide/images/${key}-dashboard.png)`;
});

const md = header + body + "\n";
writeFileSync(join(root, "docs/04-report/user-manual.md"), md, "utf8");

// HTML 주입 (id="md"> ... </script> 사이 교체, </script> 이스케이프)
const htmlPath = join(root, "docs/04-report/user-manual.html");
let html = readFileSync(htmlPath, "utf8");
const safe = md.replace(/<\/script>/gi, "<\\/script>");
html = html.replace(
  /(id="md">)[\s\S]*?(<\/script>)/,
  (_m, a: string, b: string) => a + "\n" + safe + "\n" + b,
);
writeFileSync(htmlPath, html, "utf8");

const screens = body.match(/^###\s/gm)?.length ?? 0;
console.log(`마스터 MD ${md.length.toLocaleString()}자 · 섹션 ${order.length}개 · ### 화면 ${screens}개 · 대시보드 캡처 삽입 · HTML 주입 완료`);
