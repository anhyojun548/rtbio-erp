/**
 * format — 통화·숫자 표시 헬퍼.
 *
 * - `formatKRW(n)`: 일반 콤마 표기 (`₩1,234,567`)
 * - `formatKRWShort(n)`: 큰 숫자 축약 (`₩141.6억` / `₩142만원` / `₩9,500`)
 *
 * QA 리포트 B4 — "₩1416942만" 가독성 문제 해결용.
 */

export function formatKRW(n: number | bigint): string {
  const num = typeof n === "bigint" ? Number(n) : n;
  return "₩" + num.toLocaleString("ko-KR");
}

/**
 * 큰 금액을 사람이 읽기 좋게 축약.
 * - n >= 1,0000,0000 (1억) → `₩X.X억` (소수점 1자리, 1000억 이상은 정수)
 * - n >= 1,0000      (1만) → `₩X,XXX만원`
 * - 그 외                    → `₩{콤마 표기}`
 */
export function formatKRWShort(n: number | bigint): string {
  const num = typeof n === "bigint" ? Number(n) : n;
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs >= 100_000_000_000) {
    // 1000억 이상 — 정수 억
    return `${sign}₩${Math.round(abs / 100_000_000).toLocaleString("ko-KR")}억`;
  }
  if (abs >= 100_000_000) {
    // 1억 ~ 999억 — 소수점 1자리
    const ok = (abs / 100_000_000).toFixed(1);
    return `${sign}₩${ok}억`;
  }
  if (abs >= 10_000) {
    // 1만 ~ 9999만
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString("ko-KR")}만원`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
}
