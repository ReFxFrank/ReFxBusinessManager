import { ShoppingCart, Users, Receipt, Boxes } from "lucide-react";
import { formatMoney } from "@/lib/money";
import {
  dashboardKpis,
  rangeSalesSeries,
  type DashboardRangeKey,
} from "@/lib/analytics";
import { MetricCard, DeltaLine } from "@/components/metric-card";
import { SparkAreaChart } from "@/components/charts";
import { RangeSelect } from "../range-select";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const RANGE_KEYS: DashboardRangeKey[] = ["month", "30d", "year"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = (RANGE_KEYS.includes(sp.range as DashboardRangeKey) ? sp.range : "month") as DashboardRangeKey;
  const compareLabel = range === "year" ? "vs last year" : range === "30d" ? "vs prev 30 days" : "vs last month";

  const [kpis, series] = await Promise.all([dashboardKpis(range), rangeSalesSeries(range)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <RangeSelect value={range} basePath="/dashboard" />
      </div>

      {/* Sales overview */}
      <Card className="p-4">
        <p className="text-sm font-medium text-muted-foreground">Sales Overview</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{formatMoney(kpis.revenue.value)}</p>
          <DeltaLine delta={kpis.revenue.deltaPct} goodWhenUp compareLabel={compareLabel} />
        </div>
        <p className="text-xs text-muted-foreground">Total revenue · {kpis.label}</p>
        <div className="mt-3">
          {series.length > 0 ? (
            <SparkAreaChart data={series.map((s) => ({ date: s.date, value: s.revenue }))} />
          ) : (
            <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">No sales in this period</div>
          )}
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Orders" value={String(kpis.orders.value)} icon={ShoppingCart} delta={kpis.orders.deltaPct} goodWhenUp compareLabel={compareLabel} />
        <MetricCard label="New Customers" value={String(kpis.newCustomers.value)} icon={Users} delta={kpis.newCustomers.deltaPct} goodWhenUp compareLabel={compareLabel} />
        <MetricCard label="Avg Order Value" value={formatMoney(kpis.avgOrderValue.value)} icon={Receipt} delta={kpis.avgOrderValue.deltaPct} goodWhenUp compareLabel={compareLabel} />
        <MetricCard label="Units Sold" value={String(kpis.unitsSold.value)} icon={Boxes} delta={kpis.unitsSold.deltaPct} goodWhenUp compareLabel={compareLabel} />
      </div>
    </div>
  );
}
