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
