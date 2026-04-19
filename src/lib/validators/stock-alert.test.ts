import { describe, it, expect } from "vitest";
import {
  classifyStock,
  compareStockUrgency,
  STOCK_LEVEL_LABEL,
} from "./stock-alert";

describe("classifyStock", () => {
  it("physicalStock == 0 && reorderPoint=10 → OUT, deficit=10", () => {
    const r = classifyStock({
      physicalStock: 0,
      availableStock: 0,
      reorderPoint: 10,
    });
    expect(r.level).toBe("OUT");
    expect(r.deficit).toBe(10);
  });

  it("physicalStock == 0 && reorderPoint=null → OUT, deficit=0", () => {
    const r = classifyStock({
      physicalStock: 0,
      availableStock: 0,
      reorderPoint: null,
    });
    expect(r.level).toBe("OUT");
    expect(r.deficit).toBe(0);
  });

  it("0 < physicalStock ≤ reorderPoint → LOW", () => {
    const r = classifyStock({
      physicalStock: 5,
      availableStock: 5,
      reorderPoint: 10,
    });
    expect(r.level).toBe("LOW");
    expect(r.deficit).toBe(5);
  });

  it("physicalStock == reorderPoint → LOW, deficit=0", () => {
    const r = classifyStock({
      physicalStock: 10,
      availableStock: 10,
      reorderPoint: 10,
    });
    expect(r.level).toBe("LOW");
    expect(r.deficit).toBe(0);
  });

  it("physicalStock > reorderPoint → OK", () => {
    const r = classifyStock({
      physicalStock: 100,
      availableStock: 100,
      reorderPoint: 10,
    });
    expect(r.level).toBe("OK");
    expect(r.deficit).toBe(0);
  });

  it("reorderPoint=null && physicalStock>0 → OK (알럼 대상 아님)", () => {
    const r = classifyStock({
      physicalStock: 1,
      availableStock: 1,
      reorderPoint: null,
    });
    expect(r.level).toBe("OK");
  });

  it("reorderPoint=0 && physicalStock>0 → OK", () => {
    const r = classifyStock({
      physicalStock: 1,
      availableStock: 1,
      reorderPoint: 0,
    });
    expect(r.level).toBe("OK");
  });
});

describe("compareStockUrgency", () => {
  it("OUT 이 LOW 보다 먼저", () => {
    const out = classifyStock({ physicalStock: 0, availableStock: 0, reorderPoint: 10 });
    const low = classifyStock({ physicalStock: 3, availableStock: 3, reorderPoint: 10 });
    expect(compareStockUrgency(out, low)).toBeLessThan(0);
  });

  it("같은 level 내에서는 deficit 큰게 먼저", () => {
    const a = classifyStock({ physicalStock: 1, availableStock: 1, reorderPoint: 10 }); // deficit 9
    const b = classifyStock({ physicalStock: 7, availableStock: 7, reorderPoint: 10 }); // deficit 3
    expect(compareStockUrgency(a, b)).toBeLessThan(0);
  });

  it("정렬 실사용 — 섞인 4개 배열", () => {
    const items = [
      { k: "b", a: classifyStock({ physicalStock: 20, availableStock: 20, reorderPoint: 10 }) }, // OK
      { k: "a", a: classifyStock({ physicalStock: 0, availableStock: 0, reorderPoint: 10 }) }, // OUT
      { k: "c", a: classifyStock({ physicalStock: 2, availableStock: 2, reorderPoint: 10 }) }, // LOW d8
      { k: "d", a: classifyStock({ physicalStock: 8, availableStock: 8, reorderPoint: 10 }) }, // LOW d2
    ];
    const sorted = [...items].sort((x, y) => compareStockUrgency(x.a, y.a));
    expect(sorted.map((s) => s.k)).toEqual(["a", "c", "d", "b"]);
  });
});

describe("STOCK_LEVEL_LABEL", () => {
  it("3 레벨 한글 라벨", () => {
    expect(STOCK_LEVEL_LABEL.OUT).toBe("품절");
    expect(STOCK_LEVEL_LABEL.LOW).toBe("부족");
    expect(STOCK_LEVEL_LABEL.OK).toBe("정상");
  });
});
