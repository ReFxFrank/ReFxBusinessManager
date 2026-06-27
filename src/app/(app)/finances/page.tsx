import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import {
  dashboardSummary,
  rangeSalesSeries,
  recentActivity,
  type DashboardRangeKey,
} from "@/lib/analytics";
import { MetricCard, DeltaLine } from "@/components/metric-card";
import { SparkAreaChart } from "@/components/charts";
import { EmptyState } from "@/components/shared";
import { RangeSelect } from "../range-select";

export const dynamic = "force-dynamic";

const RANGE_KEYS: DashboardRangeKey[] = ["month", "30d", "year"];

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = (RANGE_KEYS.includes(sp.range as DashboardRangeKey) ? sp.range : "month") as DashboardRangeKey;
  const compareLabel = range === "year" ? "vs last year" : range === "30d" ? "vs prev 30 days" : "vs last month";

  const [summary, series, activity] = await Promise.all([
    dashboardSummary(range),
    rangeSalesSeries(range),
    recentActivity(8),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Finances</h1>
        <RangeSelect value={range} basePath="/finances" />
      </div>

      {/* Profit overview */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Profit Overview</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{formatMoney(summary.netProfit.value)}</p>
          <DeltaLine delta={summary.netProfit.deltaPct} goodWhenUp compareLabel={compareLabel} />
        </div>
        <p className="text-xs text-muted-foreground">Net profit · {summary.label}</p>
        <div className="mt-3">
          {series.length > 0 ? (
            <SparkAreaChart data={series.map((s) => ({ date: s.date, value: s.grossProfit }))} />
          ) : (
            <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">No profit in this period</div>
          )}
        </div>
      </div>

      {/* Income / Expenses */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Income" value={formatMoney(summary.revenue.value)} icon={ArrowDownLeft} delta={summary.revenue.deltaPct} goodWhenUp compareLabel={compareLabel} />
        <MetricCard label="Expenses" value={formatMoney(summary.expenses.value)} icon={ArrowUpRight} delta={summary.expenses.deltaPct} goodWhenUp={false} compareLabel={compareLabel} />
      </div>

      {/* Recent transactions */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Recent Transactions</h2>
        {activity.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {activity.map((entry, i) => {
              const positive = entry.amount >= 0;
              const Icon = positive ? ArrowDownLeft : Wallet;
              return (
                <Link key={entry.id} href={entry.href} className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/50 ${i > 0 ? "border-t" : ""}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${positive ? "bg-accent text-success" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${positive ? "text-success" : "text-foreground"}`}>
                      {positive ? "+" : "−"}
                      {formatMoney(Math.abs(entry.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Wallet} title="No transactions yet" description="Sales, purchases and expenses will show up here." />
        )}
      </section>
    </div>
  );
}
