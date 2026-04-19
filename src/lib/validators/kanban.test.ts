import { describe, it, expect } from "vitest";
import {
  createKanbanColumnSchema,
  updateKanbanColumnSchema,
  reorderKanbanColumnsSchema,
} from "./kanban";

describe("createKanbanColumnSchema", () => {
  it("정상 입력 — 기본값 isTerminal=false 주입", () => {
    const r = createKanbanColumnSchema.parse({
      key: "PACKING",
      label: "포장",
      sortOrder: 3,
    });
    expect(r.key).toBe("PACKING");
    expect(r.isTerminal).toBe(false);
  });

  it("소문자 key 거부", () => {
    const r = createKanbanColumnSchema.safeParse({
      key: "packing",
      label: "포장",
      sortOrder: 1,
    });
    expect(r.success).toBe(false);
  });

  it("label 공백 trim", () => {
    const r = createKanbanColumnSchema.parse({
      key: "A",
      label: "  포장  ",
      sortOrder: 0,
    });
    expect(r.label).toBe("포장");
  });

  it("sortOrder 음수 거부", () => {
    const r = createKanbanColumnSchema.safeParse({
      key: "A",
      label: "X",
      sortOrder: -1,
    });
    expect(r.success).toBe(false);
  });

  it("color #RRGGBB 만 허용", () => {
    const good = createKanbanColumnSchema.parse({
      key: "A",
      label: "X",
      sortOrder: 0,
      color: "#aabbcc",
    });
    expect(good.color).toBe("#aabbcc");
    const bad = createKanbanColumnSchema.safeParse({
      key: "A",
      label: "X",
      sortOrder: 0,
      color: "red",
    });
    expect(bad.success).toBe(false);
  });

  it("color 빈 문자열은 undefined", () => {
    const r = createKanbanColumnSchema.parse({
      key: "A",
      label: "X",
      sortOrder: 0,
      color: "",
    });
    expect(r.color).toBeUndefined();
  });

  it("key 첫 글자 숫자 거부", () => {
    const r = createKanbanColumnSchema.safeParse({
      key: "1START",
      label: "X",
      sortOrder: 0,
    });
    expect(r.success).toBe(false);
  });
});

describe("updateKanbanColumnSchema", () => {
  it("모든 필드 optional — 빈 객체 허용", () => {
    const r = updateKanbanColumnSchema.parse({});
    expect(r).toEqual({});
  });

  it("isTerminal 만 변경 가능", () => {
    const r = updateKanbanColumnSchema.parse({ isTerminal: true });
    expect(r.isTerminal).toBe(true);
  });
});

describe("reorderKanbanColumnsSchema", () => {
  it("정상 배열", () => {
    const r = reorderKanbanColumnsSchema.parse({
      items: [
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1 },
      ],
    });
    expect(r.items.length).toBe(2);
  });

  it("빈 배열 거부", () => {
    const r = reorderKanbanColumnsSchema.safeParse({ items: [] });
    expect(r.success).toBe(false);
  });

  it("id 중복 거부", () => {
    const r = reorderKanbanColumnsSchema.safeParse({
      items: [
        { id: "a", sortOrder: 0 },
        { id: "a", sortOrder: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("33개 이상 거부", () => {
    const items = Array.from({ length: 33 }, (_, i) => ({
      id: `x${i}`,
      sortOrder: i,
    }));
    const r = reorderKanbanColumnsSchema.safeParse({ items });
    expect(r.success).toBe(false);
  });
});
