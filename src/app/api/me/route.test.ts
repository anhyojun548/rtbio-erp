import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";
import { getServerSession } from "next-auth";

describe("/api/me", () => {
  it("세션 없으면 401 + error", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("세션 있으면 사용자 정보 JSON 반환", async () => {
    (getServerSession as any).mockResolvedValue({
      user: {
        id: "u1",
        email: "owner@rtbio.com",
        name: "이대표",
        role: "TENANT_OWNER",
        tenantId: "t1",
        tenantCode: "altibio",
        clientId: null,
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe("TENANT_OWNER");
    expect(data.email).toBe("owner@rtbio.com");
    expect(data.id).toBe("u1");
    expect(data.tenantCode).toBe("altibio");
  });

  it("session.user.clientId 존재 시 같이 반환", async () => {
    (getServerSession as any).mockResolvedValue({
      user: {
        id: "u2",
        email: "c@x.local",
        role: "CLIENT",
        tenantId: "t1",
        tenantCode: "altibio",
        clientId: "client-abc",
      },
    });
    const data = await (await GET()).json();
    expect(data.clientId).toBe("client-abc");
  });

  it("session.user.clientId 없으면 null 반환", async () => {
    (getServerSession as any).mockResolvedValue({
      user: {
        id: "u3",
        email: "admin@rtbio.com",
        role: "ADMIN",
        tenantId: "t1",
        tenantCode: "altibio",
        clientId: null,
      },
    });
    const data = await (await GET()).json();
    expect(data.clientId).toBe(null);
  });
});
