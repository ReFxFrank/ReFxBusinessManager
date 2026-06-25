import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { formatMoney, formatPct } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import {
  businessSummary,
  inventoryValue,
  lowStockItems,
  itemProfitability,
  trendSeries,
  outstanding,
  defaultPeriod,
} from "@/lib/analytics";
import { PageHeader, StatCard, EmptyState, MarginBadge, Money } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueProfitChart } from "@/components/charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const period = defaultPeriod();
  const [summary, invValue, lowStock, itemProfit, trend, owed, recentSales] = await Promise.all([
    businessSummary(period),
    inventoryValue(),
    lowStockItems(),
    itemProfitability(period),
    trendSeries(period),
    outstanding(),
    prisma.sale.findMany({ orderBy: { date: "desc" }, take: 6, include: { contact: true } }),
  ]);

  const topMargin = [...itemProfit].filter((i) => i.margin !== null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0)).slice(0, 5);
  const bottomMargin = [...itemProfit].filter((i) => i.margin !== null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="How profitable is this business right now? (last 30 days)" />

      {/* Headline numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue (30d)"
          value={formatMoney(summary.revenue)}
          sub={`${summary.salesCount} sales`}
        />
        <StatCard
          label="Gross profit"
          value={formatMoney(summary.grossProfit)}
          accent={summary.grossProfit < 0 ? "destructive" : "success"}
          sub={`Margin ${formatPct(summary.grossMargin)}`}
        />
        <StatCard
          label="Net profit"
          value={formatMoney(summary.netProfit)}
          accent={summary.netProfit < 0 ? "destructive" : "success"}
          sub={`Net margin ${formatPct(summary.netMargin)}`}
        />
        <StatCard label="Inventory value" value={formatMoney(invValue)} href="/inventory" sub="At avg cost" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Operating expenses (30d)" value={formatMoney(summary.operatingExpenses)} href="/expenses" />
        <StatCard label="Other income (30d)" value={formatMoney(summary.otherIncome)} href="/expenses" />
        <StatCard
          label="Receivables (unpaid sales)"
          value={formatMoney(owed.receivables)}
          accent={owed.receivables > 0 ? "warning" : "default"}
          sub={`${owed.receivableCount} open`}
          href="/sales?status=unpaid"
        />
        <StatCard
          label="Payables (unpaid bills)"
          value={formatMoney(owed.payables)}
          accent={owed.payables > 0 ? "warning" : "default"}
          sub={`${owed.payableCount} open`}
          href="/purchases?status=unpaid"
        />
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Revenue vs. gross profit (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState icon={DollarSign} title="No sales in this period yet" />
          ) : (
            <RevenueProfitChart data={trend} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top / bottom margin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-success" /> Best-margin products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarginList rows={topMargin} empty="No sales yet." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-destructive" /> Worst-margin products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarginList rows={bottomMargin} empty="No sales yet." />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Low stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything is above its reorder threshold. 🎉</p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 8).map((i) => (
                  <Link
                    key={i.id}
                    href={`/inventory/${i.id}`}
                    className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      {i.primaryMedia?.thumbnailPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={storage.localUrl(i.primaryMedia.thumbnailPath)} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{i.name}</span>
                    </div>
                    <Badge variant="warning">
                      {i.quantity} / {i.reorderThreshold} {i.unit}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <EmptyState title="No sales yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/sales/${s.id}`} className="hover:underline">
                          {formatDate(s.date)}
                        </Link>
                      </TableCell>
                      <TableCell>{s.contact?.name ?? "Walk-in"}</TableCell>
                      <TableCell className="text-right">
                        <Money cents={s.revenue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money cents={s.grossProfit} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MarginList({
  rows,
  empty,
}: {
  rows: { itemId: string; name: string; revenue: number; grossProfit: number; margin: number | null }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Link
          key={r.itemId}
          href={`/inventory/${r.itemId}`}
          className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-accent"
        >
          <span className="font-medium">{r.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground tabular-nums">{formatMoney(r.grossProfit)}</span>
            <MarginBadge margin={r.margin} />
          </div>
        </Link>
      ))}
    </div>
  );
}
