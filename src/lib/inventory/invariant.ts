/**
 * 이중재고 불변식 + 공용 에러 클래스 (순수 도메인 로직).
 *
 * `"use server"` 파일은 함수만 export 가능 → 테스트/재사용 목적으로
 * InventoryError 클래스와 assertInvariant 를 분리.
 */

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

/**
 * 이중재고 불변식. 변동 후 값에 대해 검증.
 *   physical >= 0
 *   available >= 0
 *   physical >= available (창고에 없는 수량을 팔 수 없음)
 */
export function assertInvariant(physical: number, available: number): void {
  if (physical < 0)
    throw new InventoryError("실재고는 0 미만이 될 수 없습니다.");
  if (available < 0)
    throw new InventoryError("가용재고는 0 미만이 될 수 없습니다.");
  if (physical < available)
    throw new InventoryError(
      `불변식 위반: 실재고(${physical}) < 가용재고(${available})`,
    );
}
