import { describe, it, expect } from "vitest";
import { TEAM_BY_ROLE, isMetaAdmin, isEffectiveTeamAdmin, canGrantRole } from "./team";

type U = { role: any; isTeamAdmin: boolean };
const owner: U = { role: "TENANT_OWNER", isTeamAdmin: true };
const adminPlain: U = { role: "ADMIN", isTeamAdmin: false };
const qcLead: U = { role: "QC", isTeamAdmin: true };
const qcStaff: U = { role: "QC", isTeamAdmin: false };
const execLead: U = { role: "EXEC", isTeamAdmin: true };

describe("TEAM_BY_ROLE", () => {
  it("maps roles to teams", () => {
    expect(TEAM_BY_ROLE.QC).toBe("quality");
    expect(TEAM_BY_ROLE.ADMIN).toBe("finance");
    expect(TEAM_BY_ROLE.EXEC).toBe("sales");
    expect(TEAM_BY_ROLE.TENANT_OWNER).toBe("executive");
    expect(TEAM_BY_ROLE.CLIENT).toBeNull();
  });
});

describe("isMetaAdmin", () => {
  it("ADMIN/OWNER are meta admins", () => {
    expect(isMetaAdmin(adminPlain)).toBe(true);
    expect(isMetaAdmin(owner)).toBe(true);
  });
  it("QC/EXEC are not, even as team admin", () => {
    expect(isMetaAdmin(qcLead)).toBe(false);
    expect(isMetaAdmin(execLead)).toBe(false);
  });
});

describe("isEffectiveTeamAdmin", () => {
  it("meta admins are auto effective", () => {
    expect(isEffectiveTeamAdmin(adminPlain)).toBe(true);
  });
  it("QC needs the flag", () => {
    expect(isEffectiveTeamAdmin(qcLead)).toBe(true);
    expect(isEffectiveTeamAdmin(qcStaff)).toBe(false);
  });
});

describe("canGrantRole", () => {
  it("owner can grant any staff role", () => {
    expect(canGrantRole(owner, "QC")).toBe(true);
    expect(canGrantRole(owner, "ADMIN")).toBe(true);
    expect(canGrantRole(owner, "TENANT_OWNER")).toBe(true);
  });
  it("QC lead can only grant QC", () => {
    expect(canGrantRole(qcLead, "QC")).toBe(true);
    expect(canGrantRole(qcLead, "ADMIN")).toBe(false);
    expect(canGrantRole(qcLead, "EXEC")).toBe(false);
  });
  it("ADMIN (non-owner) can only grant ADMIN", () => {
    expect(canGrantRole(adminPlain, "ADMIN")).toBe(true);
    expect(canGrantRole(adminPlain, "QC")).toBe(false);
  });
  it("nobody can grant CLIENT or SUPER_ADMIN via staff mgmt", () => {
    expect(canGrantRole(owner, "CLIENT")).toBe(false);
    expect(canGrantRole(owner, "SUPER_ADMIN")).toBe(false);
    expect(canGrantRole(owner, "VIEWER")).toBe(false);
  });
});
