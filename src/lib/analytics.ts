/**
 * Profit & margin analytics — the headline feature.
 *
 * Revenue − COGS = gross profit; gross profit − operating expenses = net profit.
 * All figures in integer cents. Realized profit uses the snapshotted SaleLine
 * cost, so reports never shift when later purchases change the moving average.
 */

import { prisma } from "./prisma";
import { marginPct } from "./money";

export interface Period {
  from: Date;
  to: Date;
}

/** Default period: last 30 days through now. */
export function defaultPeriod(): Period {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return { from, to };
}

export async function businessSummary(period: Period) {
  const sales = await prisma.sale.findMany({
    where: { date: { gte: period.from, lte: period.to } },
    select: { revenue: true, cogs: true, grossProfit: true, status: true },
  });

  const revenue = sales.reduce((s, x) => s + x.revenue, 0);
  const cogs = sales.reduce((s, x) => s + x.cogs, 0);
  const grossProfit = revenue - cogs;

  const expenseRows = await prisma.expense.findMany({
    where: { date: { gte: period.from, lte: period.to } },
    select: { amount: true, kind: true },
  });
  const operatingExpenses = expenseRows
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const otherIncome = expenseRows
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + e.amount, 0);

  const netProfit = grossProfit - operatingExpenses + otherIncome;

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin: marginPct(grossProfit, revenue),
    operatingExpenses,
    otherIncome,
    netProfit,
    netMargin: marginPct(netProfit, revenue),
    salesCount: sales.length,
  };
}

export async function inventoryValue() {
  const items = await prisma.item.findMany({ select: { quantity: true, avgCost: true } });
  return items.reduce((s, i) => s + Math.round(i.quantity * i.avgCost), 0);
}

export async function lowStockItems() {
  const items = await prisma.item.findMany({
    include: { primaryMedia: true },
    orderBy: { quantity: "asc" },
  });
  return items.filter((i) => i.quantity <= i.reorderThreshold);
}

export interface ItemProfit {
  itemId: string;
  name: string;
  sku: string;
  category: string | null;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number | null;
}

export async function itemProfitability(period: Period): Promise<ItemProfit[]> {
  const lines = await prisma.saleLine.findMany({
    where: { sale: { date: { gte: period.from, lte: period.to } } },
    include: { item: { select: { name: true, sku: true, category: true } } },
  });

  const map = new Map<string, ItemProfit>();
  for (const line of lines) {
    const existing =
      map.get(line.itemId) ??
      ({
        itemId: line.itemId,
        name: line.item.name,
        sku: line.item.sku,
        category: line.item.category,
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        margin: null,
      } satisfies ItemProfit);
    existing.unitsSold += line.qty;
    existing.revenue += line.lineRevenue;
    existing.cogs += line.lineCogs;
    existing.grossProfit += line.lineProfit;
    map.set(line.itemId, existing);
  }

  return Array.from(map.values())
    .map((x) => ({ ...x, margin: marginPct(x.grossProfit, x.revenue) }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

export async function categoryProfitability(period: Period) {
  const items = await itemProfitability(period);
  const map = new Map<string, { category: string; revenue: number; cogs: number; grossProfit: number; unitsSold: number }>();
  for (const it of items) {
    const key = it.category || "Uncategorized";
    const existing = map.get(key) ?? { category: key, revenue: 0, cogs: 0, grossProfit: 0, unitsSold: 0 };
    existing.revenue += it.revenue;
    existing.cogs += it.cogs;
    existing.grossProfit += it.grossProfit;
    existing.unitsSold += it.unitsSold;
    map.set(key, existing);
  }
  return Array.from(map.values())
    .map((x) => ({ ...x, margin: marginPct(x.grossProfit, x.revenue) }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

/** Daily revenue + profit series for trend charts. */
export async function trendSeries(period: Period) {
  const sales = await prisma.sale.findMany({
    where: { date: { gte: period.from, lte: period.to } },
    select: { date: true, revenue: true, grossProfit: true },
    orderBy: { date: "asc" },
  });

  const buckets = new Map<string, { date: string; revenue: number; grossProfit: number }>();
  for (const s of sales) {
    const key = s.date.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { date: key, revenue: 0, grossProfit: 0 };
    b.revenue += s.revenue;
    b.grossProfit += s.grossProfit;
    buckets.set(key, b);
  }
  return Array.from(buckets.values());
}

// ---------------------------------------------------------------------------
// Mobile dashboard: period selector with month-over-month deltas + activity
// ---------------------------------------------------------------------------

export type DashboardRangeKey = "month" | "30d" | "year";

export interface RangeWindow {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  label: string;
}

/** Resolve the selected range plus the comparable previous range. */
export function periodRange(key: DashboardRangeKey): RangeWindow {
  const now = new Date();
  if (key === "30d") {
    const to = now;
    const from = new Date(now.getTime() - 30 * 864e5);
    return { from, to, prevFrom: new Date(from.getTime() - 30 * 864e5), prevTo: from, label: "Last 30 Days" };
  }
  if (key === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return {
      from,
      to: now,
      prevFrom: new Date(now.getFullYear() - 1, 0, 1),
      prevTo: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
      label: "This Year",
    };
  }
  // calendar month vs previous calendar month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from,
    to: now,
    prevFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    prevTo: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
    label: "This Month",
  };
}

/** Percentage change current vs previous; null when previous is 0 (no base). */
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface DashboardMetric {
  value: number; // cents
  deltaPct: number | null; // vs previous comparable period
}

export async function dashboardSummary(key: DashboardRangeKey) {
  const r = periodRange(key);
  const [cur, prev, owed] = await Promise.all([
    businessSummary({ from: r.from, to: r.to }),
    businessSummary({ from: r.prevFrom, to: r.prevTo }),
    outstanding(),
  ]);

  // "Total Expenses" here = COGS + operating expenses (all money out), so the
  // card trio reads cleanly: Revenue − Total Expenses ≈ Net Profit.
  const curExpenses = cur.cogs + cur.operatingExpenses;
  const prevExpenses = prev.cogs + prev.operatingExpenses;

  const revenue: DashboardMetric = { value: cur.revenue, deltaPct: deltaPct(cur.revenue, prev.revenue) };
  const expenses: DashboardMetric = { value: curExpenses, deltaPct: deltaPct(curExpenses, prevExpenses) };
  const netProfit: DashboardMetric = { value: cur.netProfit, deltaPct: deltaPct(cur.netProfit, prev.netProfit) };

  return {
    label: r.label,
    revenue,
    expenses,
    netProfit,
    grossMargin: cur.grossMargin,
    netMargin: cur.netMargin,
    outstandingInvoices: { count: owed.receivableCount, total: owed.receivables },
  };
}

/** KPI tiles for the Dashboard screen (orders, customers, AOV, units). */
export async function dashboardKpis(key: DashboardRangeKey) {
  const r = periodRange(key);

  async function windowStats(from: Date, to: Date) {
    const [sales, newCustomers, unitAgg] = await Promise.all([
      prisma.sale.findMany({ where: { date: { gte: from, lte: to } }, select: { revenue: true } }),
      prisma.contact.count({ where: { type: { in: ["customer", "both"] }, createdAt: { gte: from, lte: to } } }),
      prisma.saleLine.aggregate({ where: { sale: { date: { gte: from, lte: to } } }, _sum: { qty: true } }),
    ]);
    const orders = sales.length;
    const revenue = sales.reduce((s, x) => s + x.revenue, 0);
    const units = unitAgg._sum.qty ?? 0;
    const aov = orders > 0 ? Math.round(revenue / orders) : 0;
    return { orders, newCustomers, units, aov, revenue };
  }

  const [cur, prev] = await Promise.all([
    windowStats(r.from, r.to),
    windowStats(r.prevFrom, r.prevTo),
  ]);

  return {
    label: r.label,
    revenue: { value: cur.revenue, deltaPct: deltaPct(cur.revenue, prev.revenue) },
    orders: { value: cur.orders, deltaPct: deltaPct(cur.orders, prev.orders) },
    newCustomers: { value: cur.newCustomers, deltaPct: deltaPct(cur.newCustomers, prev.newCustomers) },
    avgOrderValue: { value: cur.aov, deltaPct: deltaPct(cur.aov, prev.aov) },
    unitsSold: { value: cur.units, deltaPct: deltaPct(cur.units, prev.units) },
  };
}

/** Daily revenue series for the selected range (compact chart). */
export async function rangeSalesSeries(key: DashboardRangeKey) {
  const r = periodRange(key);
  return trendSeries({ from: r.from, to: r.to });
}

export type ActivityKind = "payment" | "invoice" | "purchase" | "expense" | "income";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  amount: number; // signed cents (+in / -out)
  date: Date;
  href: string;
}

/** Unified, most-recent-first feed across sales, purchases and expenses. */
export async function recentActivity(limit = 8): Promise<ActivityEntry[]> {
  const [sales, purchases, expenses] = await Promise.all([
    prisma.sale.findMany({ orderBy: { date: "desc" }, take: limit, include: { contact: true } }),
    prisma.purchase.findMany({ orderBy: { date: "desc" }, take: limit, include: { contact: true } }),
    prisma.expense.findMany({ orderBy: { date: "desc" }, take: limit }),
  ]);

  const entries: ActivityEntry[] = [];

  for (const s of sales) {
    const paid = s.status === "paid";
    entries.push({
      id: `sale-${s.id}`,
      kind: paid ? "payment" : "invoice",
      title: paid ? "Payment received" : "Invoice sent",
      subtitle: `${s.contact?.name ?? "Walk-in"} · #${s.id.slice(-6).toUpperCase()}`,
      amount: s.revenue,
      date: s.date,
      href: `/sales/${s.id}`,
    });
  }
  for (const p of purchases) {
    entries.push({
      id: `pur-${p.id}`,
      kind: "purchase",
      title: "Stock purchased",
      subtitle: `${p.contact?.name ?? "Supplier"} · #${p.id.slice(-6).toUpperCase()}`,
      amount: -p.total,
      date: p.date,
      href: `/purchases/${p.id}`,
    });
  }
  for (const e of expenses) {
    const income = e.kind === "income";
    entries.push({
      id: `exp-${e.id}`,
      kind: income ? "income" : "expense",
      title: income ? "Income added" : "Expense added",
      subtitle: e.note ? `${e.category} · ${e.note}` : e.category,
      amount: income ? e.amount : -e.amount,
      date: e.date,
      href: "/expenses",
    });
  }

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export async function outstanding() {
  const unpaidSales = await prisma.sale.findMany({
    where: { status: "unpaid" },
    select: { revenue: true },
  });
  const unpaidPurchases = await prisma.purchase.findMany({
    where: { status: "unpaid" },
    select: { total: true },
  });
  const unpaidExpenses = await prisma.expense.findMany({
    where: { status: "unpaid", kind: "expense" },
    select: { amount: true },
  });

  const receivables = unpaidSales.reduce((s, x) => s + x.revenue, 0);
  const payables =
    unpaidPurchases.reduce((s, x) => s + x.total, 0) +
    unpaidExpenses.reduce((s, x) => s + x.amount, 0);

  return { receivables, payables, receivableCount: unpaidSales.length, payableCount: unpaidPurchases.length + unpaidExpenses.length };
}
