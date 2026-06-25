import { TrendingUp } from "lucide-react";
import {
  businessSummary,
  itemProfitability,
  categoryProfitability,
  trendSeries,
} from "@/lib/analytics";
import { formatMoney, formatPct, marginPct } from "@/lib/money";
import { PageHeader, StatCard, MarginBadge, Money, EmptyState } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RevenueProfitChart, MarginTrendChart, CategoryBarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, number> = { "7": 7, "30": 30, "90": 90, "365": 365, "730": 730 };
const LABELS: Record<string, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  "365": "Last year",
  "730": "Last 2 years",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const periodKey = sp.period && sp.period in PERIODS ? sp.period : "90";
  const days = PERIODS[periodKey];
  const period = { from: new Date(Date.now() - days * 864e5), to: new Date() };
  const sortKey = sp.sort ?? "profit";

  const [summary, items, categories, trend] = await Promise.all([
    businessSummary(period),
    itemProfitability(period),
    categoryProfitability(period),
    trendSeries(period),
  ]);

  const sortedItems = [...items].sort((a, b) => {
    if (sortKey === "margin") return (b.margin ?? -Infinity) - (a.margin ?? -Infinity);
    if (sortKey === "revenue") return b.revenue - a.revenue;
    if (sortKey === "units") return b.unitsSold - a.unitsSold;
    return b.grossProfit - a.grossProfit;
  });

  const marginTrend = trend.map((t) => ({
    date: t.date,
    margin: t.revenue > 0 ? Number(((t.grossProfit / t.revenue) * 100).toFixed(1)) : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Reports"
        description="Revenue − COGS = gross profit · gross profit − operating expenses = net profit."
        action={
          <form className="flex items-center gap-2">
            <select name="period" defaultValue={periodKey} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {Object.keys(PERIODS).map((k) => (
                <option key={k} value={k}>
                  {LABELS[k]}
                </option>
              ))}
            </select>
            <input type="hidden" name="sort" value={sortKey} />
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>
        }
      />

      {/* P&L */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={formatMoney(summary.revenue)} />
        <StatCard label="COGS" value={formatMoney(summary.cogs)} />
        <StatCard label="Gross profit" value={formatMoney(summary.grossProfit)} accent={summary.grossProfit < 0 ? "destructive" : "success"} sub={`Margin ${formatPct(summary.grossMargin)}`} />
        <StatCard label="Operating expenses" value={formatMoney(summary.operatingExpenses)} />
        <StatCard label="Other income" value={formatMoney(summary.otherIncome)} />
        <StatCard label="Net profit" value={formatMoney(summary.netProfit)} accent={summary.netProfit < 0 ? "destructive" : "success"} sub={`Net margin ${formatPct(summary.netMargin)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Revenue vs. gross profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length ? <RevenueProfitChart data={trend} /> : <EmptyState title="No sales in this period" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gross margin over time</CardTitle>
          </CardHeader>
          <CardContent>
            {marginTrend.length ? <MarginTrendChart data={marginTrend} /> : <EmptyState title="No data" />}
          </CardContent>
        </Card>
      </div>

      {/* Category profitability */}
      <Card>
        <CardHeader>
          <CardTitle>Profit by category</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          {categories.length === 0 ? (
            <EmptyState title="No category data yet" />
          ) : (
            <>
              <CategoryBarChart data={categories.map((c) => ({ category: c.category, grossProfit: c.grossProfit }))} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium">{c.category}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(c.revenue)}</TableCell>
                      <TableCell className="text-right">
                        <Money cents={c.grossProfit} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MarginBadge margin={c.margin} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Item profitability */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profit by item</CardTitle>
          <form className="flex items-center gap-2">
            <input type="hidden" name="period" value={periodKey} />
            <select name="sort" defaultValue={sortKey} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="profit">Sort: Gross profit</option>
              <option value="margin">Sort: Margin</option>
              <option value="revenue">Sort: Revenue</option>
              <option value="units">Sort: Units sold</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Sort
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <EmptyState title="No sales in this period" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((it) => (
                  <TableRow key={it.itemId}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-muted-foreground">{it.category ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(it.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(it.cogs)}</TableCell>
                    <TableCell className="text-right">
                      <Money cents={it.grossProfit} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MarginBadge margin={it.margin} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
