import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/actions/product", () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
}));

import { GET, POST } from "./route";
import { getServerSession } from "next-auth";
import { listProducts, createProduct } from "@/lib/actions/product";

beforeEach(() => vi.clearAllMocks());

describe("/api/products", () => {
  it("GET 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(new Request("http://x/api/products"));
    expect(res.status).toBe(401);
  });

  it("GET 성공 시 배열 그대로", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (listProducts as any).mockResolvedValue([{ id: "p1", name: "제품A" }]);
    const res = await GET(new Request("http://x/api/products?q=제품&category=의약&active=ACTIVE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "p1", name: "제품A" }]);
    // 쿼리 파라미터가 actions 로 전달되는지 확인
    expect((listProducts as any).mock.calls[0][0]).toMatchObject({
      q: "제품",
      category: "의약",
      active: "ACTIVE",
    });
  });

  it("POST 세션 없으면 401", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST 성공 시 생성 데이터 201", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createProduct as any).mockResolvedValue({
      ok: true,
      data: { id: "p2", code: "NEW-001" },
    });
    const res = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: JSON.stringify({ code: "NEW-001", name: "신규제품" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "p2", code: "NEW-001" });
  });

  it("POST validator 실패 시 400 envelope", async () => {
    (getServerSession as any).mockResolvedValue({ user: { role: "ADMIN" } });
    (createProduct as any).mockResolvedValue({
      ok: false,
      error: "제품명 필수",
      fieldErrors: { name: ["필수"] },
    });
    const res = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "제품명 필수",
      fieldErrors: { name: ["필수"] },
    });
  });
});
