import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  PackageOpen,
  FileWarning,
  Receipt,
  TrendingUp,
  ChevronRight,
  Plus,
} from "lucide-react";
import { config } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { dashboardKpis, dashboardSummary, lowStockItems, outstanding } from "@/lib/analytics";
import { MetricCard } from "@/components/metric-card";
import { Greeting } from "./greeting";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [kpis, summary, lowStock, owed, unpaidPurchases] = await Promise.all([
    dashboardKpis("month"),
    dashboardSummary("month"),
    lowStockItems(),
    outstanding(),
    prisma.purchase.count({ where: { status: "unpaid" } }),
  ]);

  // Synthesize a small "Upcoming" task list from real business state.
  const upcoming: { title: string; sub: string; href: string; icon: React.ComponentType<{ className?: string }>; alert?: boolean }[] = [];
  if (lowStock.length > 0)
    upcoming.push({
      title: `Restock ${lowStock.length} low-stock ${lowStock.length === 1 ? "item" : "items"}`,
      sub: lowStock.slice(0, 2).map((i) => i.name).join(", ") + (lowStock.length > 2 ? "…" : ""),
      href: "/inventory?seg=low",
      icon: PackageOpen,
      alert: true,
    });
  if (owed.receivableCount > 0)
    upcoming.push({
      title: `${owed.receivableCount} unpaid ${owed.receivableCount === 1 ? "invoice" : "invoices"}`,
      sub: `${formatMoney(owed.receivables)} outstanding`,
      href: "/sales?status=unpaid",
      icon: FileWarning,
    });
  if (unpaidPurchases > 0)
    upcoming.push({
      title: `${unpaidPurchases} ${unpaidPurchases === 1 ? "bill" : "bills"} to pay`,
      sub: "Unpaid supplier purchases",
      href: "/purchases?status=unpaid",
      icon: Receipt,
    });
  upcoming.push({ title: "Review this month's profit", sub: `Net ${formatMoney(summary.netProfit.value)}`, href: "/reports", icon: TrendingUp });

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <Greeting name={config.app.ownerName} />
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      {/* Overview */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Overview</h2>
          <span className="text-xs text-muted-foreground">This month</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Total Revenue" value={formatMoney(kpis.revenue.value)} icon={DollarSign} delta={kpis.revenue.deltaPct} goodWhenUp compareLabel="vs last month" />
          <MetricCard label="Orders" value={String(kpis.orders.value)} icon={ShoppingCart} delta={kpis.orders.deltaPct} goodWhenUp compareLabel="vs last month" />
          <MetricCard label="New Customers" value={String(kpis.newCustomers.value)} icon={Users} delta={kpis.newCustomers.deltaPct} goodWhenUp compareLabel="vs last month" />
          <MetricCard label="Low Stock Items" value={String(lowStock.length)} icon={AlertTriangle} sub={lowStock.length > 0 ? "Needs attention" : "All stocked"} href="/inventory?seg=low" alert={lowStock.length > 0} />
        </div>
      </section>

      {/* Quick action */}
      <Link
        href="/sales/new"
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" /> Record a sale
      </Link>

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Upcoming</h2>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {upcoming.map((u, i) => {
            const Icon = u.icon;
            return (
              <Link key={u.title} href={u.href} className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/50 ${i > 0 ? "border-t" : ""}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${u.alert ? "bg-destructive/10 text-destructive" : "bg-accent text-primary"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
