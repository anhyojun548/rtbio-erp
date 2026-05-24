/**
 * CEO 대시보드 위젯(R24) — Server Actions.
 *
 * - 사용자별 레이아웃 CRUD (DashboardWidget 모델)
 * - 프리셋 값 서버사이드 계산 (실데이터 집계)
 *
 * RBAC: TENANT_OWNER, ADMIN, SUPER_ADMIN — CEO 포털 접근 권한자.
 */
"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { monthToRange } from "@/lib/validators/ledger";
import { classifyContract } from "@/lib/validators/sales-contract";
import { classifyStock } from "@/lib/validators/stock-alert";
import {
  addWidgetSchema,
  DASHBOARD_WIDGET_PRESETS,
  DEFAULT_LAYOUT_KEYS,
  getPreset,
  isValidPresetKey,
  PRESET_BY_KEY,
  reorderWidgetsSchema,
  resetLayoutSchema,
  type AddWidgetInput,
  type ReorderWidgetsInput,
  type ResetLayoutInput,
  updateWidgetSchema,
  type UpdateWidgetInput,
  type WidgetPreset,
} from "@/lib/validators/widget-dashboard";

const CEO_ROLES = ["TENANT_OWNER", "ADMIN", "SUPER_ADMIN"] as const;
async function requireCeoUser() {
  // SUPER_ADMIN 까지 포함 — 배포 데모/관리용
  return requireRole(...CEO_ROLES);
}

// ─── CRUD ────────────────────────────────────────────
export async function listMyWidgets() {
  const me = await requireCeoUser();
  const rows = await prisma.dashboardWidget.findMany({
    where: { userId: me.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((w) => ({
    id: w.id,
    preset: w.preset,
    position: w.position,
    width: w.width,
    height: w.height,
    overrideDateRange: w.overrideDateRange,
    meta: getPreset(w.preset) ?? null,
  }));
}

export async function addWidget(input: AddWidgetInput) {
  const me = await requireCeoUser();
  const parsed = addWidgetSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.errors[0]?.message ?? "위젯 입력이 올바르지 않습니다.",
    );
  }
  const { preset, position, width, height } = parsed.data;
  const p = getPreset(preset);
  if (!p) throw new Error("알 수 없는 위젯 프리셋입니다.");

  // position 이 생략되면 현재 max+1
  let finalPosition = position;
  if (finalPosition === undefined) {
    const last = await prisma.dashboardWidget.findFirst({
      where: { userId: me.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    finalPosition = (last?.position ?? -1) + 1;
  }

  const created = await prisma.dashboardWidget.create({
    data: {
      userId: me.id,
      preset,
      position: finalPosition,
      width: width ?? p.defaultWidth,
      height: height ?? p.defaultHeight,
    },
    select: { id: true },
  });
  logAudit({
    action: "DASHBOARD_WIDGET_CREATE",
    resource: `DashboardWidget:${created.id}`,
    metadata: { preset, position: finalPosition },
  });
  revalidatePath("/ceo");
  revalidatePath("/ceo/customize");
  return created;
}

export async function updateWidget(input: UpdateWidgetInput) {
  const me = await requireCeoUser();
  const parsed = updateWidgetSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.errors[0]?.message ?? "위젯 입력이 올바르지 않습니다.",
    );
  }
  const { id, width, height, overrideDateRange } = parsed.data;

  const existing = await prisma.dashboardWidget.findFirst({
    where: { id, userId: me.id },
    select: { id: true },
  });
  if (!existing) throw new Error("위젯을 찾을 수 없습니다.");

  const data: Prisma.DashboardWidgetUpdateInput = {};
  if (width !== undefined) data.width = width;
  if (height !== undefined) data.height = height;
  if (overrideDateRange !== undefined) data.overrideDateRange = overrideDateRange;

  await prisma.dashboardWidget.update({
    where: { id },
    data,
  });
  logAudit({
    action: "DASHBOARD_WIDGET_UPDATE",
    resource: `DashboardWidget:${id}`,
    metadata: { width, height, overrideDateRange },
  });
  revalidatePath("/ceo");
  revalidatePath("/ceo/customize");
}

export async function removeWidget(id: string) {
  const me = await requireCeoUser();
  const existing = await prisma.dashboardWidget.findFirst({
    where: { id, userId: me.id },
    select: { id: true, preset: true },
  });
  if (!existing) throw new Error("위젯을 찾을 수 없습니다.");

  await prisma.dashboardWidget.delete({ where: { id } });
  logAudit({
    action: "DASHBOARD_WIDGET_DELETE",
    resource: `DashboardWidget:${id}`,
    metadata: { preset: existing.preset },
  });
  revalidatePath("/ceo");
  revalidatePath("/ceo/customize");
}

export async function reorderWidgets(input: ReorderWidgetsInput) {
  const me = await requireCeoUser();
  const parsed = reorderWidgetsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.errors[0]?.message ?? "입력이 올바르지 않습니다.",
    );
  }
  const { items } = parsed.data;

  // 소유권 검증 + bulk update in tx
  await prisma.$transaction(async (tx) => {
    const rows = await tx.dashboardWidget.findMany({
      where: { id: { in: items.map((i) => i.id) }, userId: me.id },
      select: { id: true },
    });
    if (rows.length !== items.length) {
      throw new Error("일부 위젯을 찾을 수 없습니다.");
    }
    for (const item of items) {
      await tx.dashboardWidget.update({
        where: { id: item.id },
        data: { position: item.position },
      });
    }
  });
  logAudit({
    action: "DASHBOARD_WIDGET_REORDER",
    resource: `DashboardWidget:user:${me.id}`,
    metadata: { count: items.length },
  });
  revalidatePath("/ceo");
  revalidatePath("/ceo/customize");
}

export async function resetLayout(input?: ResetLayoutInput) {
  const me = await requireCeoUser();
  const parsed = resetLayoutSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new Error(
      parsed.error.errors[0]?.message ?? "입력이 올바르지 않습니다.",
    );
  }
  const keys = parsed.data.presetKeys ?? DEFAULT_LAYOUT_KEYS;

  await prisma.$transaction(async (tx) => {
    await tx.dashboardWidget.deleteMany({ where: { userId: me.id } });
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const p = PRESET_BY_KEY[key];
      if (!p) continue;
      await tx.dashboardWidget.create({
        data: {
          userId: me.id,
          preset: key,
          position: i,
          width: p.defaultWidth,
          height: p.defaultHeight,
        },
      });
    }
  });
  logAudit({
    action: "DASHBOARD_LAYOUT_RESET",
    resource: `DashboardWidget:user:${me.id}`,
    metadata: { count: keys.length },
  });
  revalidatePath("/ceo");
  revalidatePath("/ceo/customize");
}

// ─── 프리셋 값 계산 ──────────────────────────────────

export type KpiValue = {
  kind: "kpi";
  preset: string;
  label: string;
  value: string; // 이미 포맷된 문자열
  amount?: number; // 원래 수치
  description?: string;
  href?: string;
};

export type ListRow = {
  kind: "list";
  preset: string;
  label: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  href?: string;
};

export type WidgetValue = KpiValue | ListRow;

function currentMonthKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function fmtKRW(n: number): string {
  return "₩" + n.toLocaleString("ko-KR");
}

export async function computePresetValue(
  preset: string,
  now = new Date(),
): Promise<WidgetValue | null> {
  const meta = getPreset(preset);
  if (!meta) return null;
  switch (preset) {
    case "kpi_monthly_sales":
      return computeKpiMonthlySales(meta, now);
    case "kpi_total_ar":
      return computeKpiTotalAr(meta, now);
    case "kpi_open_orders":
      return computeKpiOpenOrders(meta);
    case "kpi_active_clients":
      return computeKpiActiveClients(meta);
    case "kpi_low_stock":
      return computeKpiLowStock(meta);
    case "kpi_expiring_contracts":
      return computeKpiExpiringContracts(meta, now);
    case "list_top_clients":
      return computeListTopClients(meta, now);
    case "list_low_stock":
      return computeListLowStock(meta);
    case "list_ending_contracts":
      return computeListEndingContracts(meta, now);
    case "list_recent_orders":
      return computeListRecentOrders(meta);
    default:
      return null;
  }
}

export async function computeAllPresetValues(
  presets: string[],
  now = new Date(),
): Promise<Record<string, WidgetValue>> {
  const entries = await Promise.all(
    presets.map(async (key) => {
      if (!isValidPresetKey(key)) return null;
      const v = await computePresetValue(key, now);
      return v ? ([key, v] as const) : null;
    }),
  );
  const map: Record<string, WidgetValue> = {};
  for (const e of entries) {
    if (e) map[e[0]] = e[1];
  }
  return map;
}

// ─── KPI 계산 함수들 ─────────────────────────────────
async function computeKpiMonthlySales(
  meta: WidgetPreset,
  now: Date,
): Promise<KpiValue> {
  const { start, end } = monthToRange(currentMonthKey(now));
  const rows = await prisma.invoice.findMany({
    where: {
      issueDate: { gte: start, lt: end },
      status: { in: ["ISSUED", "SENT"] },
    },
    select: { totalAmount: true },
  });
  const sum = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
  return {
    kind: "kpi",
    preset: "kpi_monthly_sales",
    label: meta.label,
    value: fmtKRW(sum),
    amount: sum,
    description: `${rows.length}건 발행`,
    href: "/admin/invoices",
  };
}

async function computeKpiTotalAr(
  meta: WidgetPreset,
  now: Date,
): Promise<KpiValue> {
  const month = currentMonthKey(now);
  const rows = await prisma.closingLedger.findMany({
    where: { closingMonth: month },
    select: { balance: true },
  });
  const sum = rows.reduce((s, r) => s + Number(r.balance), 0);
  return {
    kind: "kpi",
    preset: "kpi_total_ar",
    label: meta.label,
    value: fmtKRW(sum),
    amount: sum,
    description: `${rows.length}개 거래처 원장`,
    href: "/admin/ledger",
  };
}

async function computeKpiOpenOrders(meta: WidgetPreset): Promise<KpiValue> {
  const count = await prisma.order.count({
    where: {
      status: { in: ["DRAFT", "SUBMITTED", "CONFIRMED", "SHIPPING"] },
    },
  });
  return {
    kind: "kpi",
    preset: "kpi_open_orders",
    label: meta.label,
    value: `${count.toLocaleString("ko-KR")}건`,
    amount: count,
    description: "DRAFT/SUBMITTED/CONFIRMED/SHIPPING",
    href: "/admin/orders",
  };
}

async function computeKpiActiveClients(meta: WidgetPreset): Promise<KpiValue> {
  const count = await prisma.client.count({ where: { active: true } });
  return {
    kind: "kpi",
    preset: "kpi_active_clients",
    label: meta.label,
    value: `${count.toLocaleString("ko-KR")}개`,
    amount: count,
    href: "/admin/clients",
  };
}

async function computeKpiLowStock(meta: WidgetPreset): Promise<KpiValue> {
  const sizes = await prisma.productSize.findMany({
    where: {
      product: { active: true },
      reorderPoint: { gt: 0 },
    },
    select: {
      physicalStock: true,
      availableStock: true,
      reorderPoint: true,
    },
  });
  let alerts = 0;
  for (const s of sizes) {
    const level = classifyStock({
      physicalStock: s.physicalStock,
      availableStock: s.availableStock,
      reorderPoint: s.reorderPoint,
    }).level;
    if (level === "OUT" || level === "LOW") alerts++;
  }
  return {
    kind: "kpi",
    preset: "kpi_low_stock",
    label: meta.label,
    value: `${alerts.toLocaleString("ko-KR")}건`,
    amount: alerts,
    description: `활성 사이즈 ${sizes.length}개 중`,
    href: "/admin/alerts/stock",
  };
}

async function computeKpiExpiringContracts(
  meta: WidgetPreset,
  now: Date,
): Promise<KpiValue> {
  const to = new Date(now);
  to.setDate(to.getDate() + 30);
  const count = await prisma.salesContract.count({
    where: {
      endDate: { gte: now, lte: to },
    },
  });
  return {
    kind: "kpi",
    preset: "kpi_expiring_contracts",
    label: meta.label,
    value: `${count.toLocaleString("ko-KR")}건`,
    amount: count,
    description: "향후 30일 이내 종료",
    href: "/admin/contracts",
  };
}

// ─── LIST 계산 함수들 ────────────────────────────────
async function computeListTopClients(
  meta: WidgetPreset,
  now: Date,
): Promise<ListRow> {
  const { start, end } = monthToRange(currentMonthKey(now));
  const invoices = await prisma.invoice.findMany({
    where: {
      issueDate: { gte: start, lt: end },
      status: { in: ["ISSUED", "SENT"] },
    },
    select: {
      clientId: true,
      totalAmount: true,
      client: { select: { name: true, code: true } },
    },
  });
  const agg = new Map<
    string,
    { name: string; code: string; amount: number }
  >();
  for (const inv of invoices) {
    const key = inv.clientId;
    const entry = agg.get(key) ?? {
      name: inv.client.name,
      code: inv.client.code,
      amount: 0,
    };
    entry.amount += Number(inv.totalAmount);
    agg.set(key, entry);
  }
  const sorted = [...agg.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return {
    kind: "list",
    preset: "list_top_clients",
    label: meta.label,
    headers: ["#", "거래처", "코드", "이달 매출"],
    rows: sorted.map((r, i) => [i + 1, r.name, r.code, fmtKRW(r.amount)]),
    href: "/admin/reports/monthly",
  };
}

async function computeListLowStock(meta: WidgetPreset): Promise<ListRow> {
  const sizes = await prisma.productSize.findMany({
    where: {
      product: { active: true },
      reorderPoint: { gt: 0 },
    },
    include: {
      product: { select: { code: true, name: true } },
    },
  });
  const rows = sizes
    .map((s) => ({
      s,
      c: classifyStock({
        physicalStock: s.physicalStock,
        availableStock: s.availableStock,
        reorderPoint: s.reorderPoint,
      }),
    }))
    .filter((e) => e.c.level === "OUT" || e.c.level === "LOW")
    .sort((a, b) => {
      if (a.c.level !== b.c.level) return a.c.level === "OUT" ? -1 : 1;
      return (b.c.deficit ?? 0) - (a.c.deficit ?? 0);
    })
    .slice(0, 5);
  return {
    kind: "list",
    preset: "list_low_stock",
    label: meta.label,
    headers: ["제품", "사이즈", "현재고", "안전재고", "부족"],
    rows: rows.map((e) => [
      `${e.s.product.code} · ${e.s.product.name}`,
      e.s.sizeCode,
      e.s.physicalStock,
      e.s.reorderPoint ?? 0,
      e.c.deficit ?? 0,
    ]),
    href: "/admin/alerts/stock",
  };
}

async function computeListEndingContracts(
  meta: WidgetPreset,
  now: Date,
): Promise<ListRow> {
  const to = new Date(now);
  to.setDate(to.getDate() + 30);
  const rows = await prisma.salesContract.findMany({
    where: {
      endDate: { gte: now, lte: to },
    },
    include: {
      client: { select: { name: true, code: true } },
    },
    orderBy: { endDate: "asc" },
    take: 5,
  });
  return {
    kind: "list",
    preset: "list_ending_contracts",
    label: meta.label,
    headers: ["거래처", "계약", "종료일", "남은 일"],
    rows: rows.map((r) => {
      const end = r.endDate!;
      const daysLeft = Math.ceil(
        (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const c = classifyContract(r.startDate, r.endDate, now);
      void c;
      return [
        r.client.name,
        r.title,
        end.toISOString().slice(0, 10),
        `${daysLeft}일`,
      ];
    }),
    href: "/admin/contracts",
  };
}

async function computeListRecentOrders(meta: WidgetPreset): Promise<ListRow> {
  const orders = await prisma.order.findMany({
    include: {
      client: { select: { name: true } },
      items: { select: { lineTotal: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return {
    kind: "list",
    preset: "list_recent_orders",
    label: meta.label,
    headers: ["주문번호", "거래처", "상태", "금액"],
    rows: orders.map((o) => {
      const total = o.items.reduce(
        (s, it) => s + Number(it.lineTotal ?? 0),
        0,
      );
      return [o.orderNumber, o.client.name, o.status, fmtKRW(total)];
    }),
    href: "/admin/orders",
  };
}

// ─── 외부 노출 ───────────────────────────────────────
export async function getMyDashboard() {
  const widgets = await listMyWidgets();
  const values = await computeAllPresetValues(widgets.map((w) => w.preset));
  return { widgets, values };
}

export async function getAllPresets() {
  return DASHBOARD_WIDGET_PRESETS;
}
