import Link from "next/link";
import { ShoppingCart, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { marginPct } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard, Money, MarginBadge, StatusBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, number | null> = { "30": 30, "90": 90, "365": 365, all: null };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const periodKey = sp.period && sp.period in PERIODS ? sp.period : "90";
  const days = PERIODS[periodKey];
  const from = days ? new Date(Date.now() - days * 864e5) : undefined;

  const where: Prisma.SaleWhereInput = {
    ...(from ? { date: { gte: from } } : {}),
    ...(sp.status === "paid" || sp.status === "unpaid" ? { status: sp.status } : {}),
  };

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { date: "desc" },
    include: { contact: true, _count: { select: { lines: true } } },
    take: 200,
  });

  const revenue = sales.reduce((s, x) => s + x.revenue, 0);
  const profit = sales.reduce((s, x) => s + x.grossProfit, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Every sale snapshots COGS and locks in realized profit."
        action={
          <Button asChild>
            <Link href="/sales/new">
              <Plus /> New sale
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Sales (period)" value={String(sales.length)} />
        <StatCard label="Revenue" value={`$${(revenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
        <StatCard
          label="Gross profit"
          value={`$${(profit / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          accent={profit < 0 ? "destructive" : "success"}
          sub={<MarginBadge margin={marginPct(profit, revenue)} />}
        />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <select name="period" defaultValue={periodKey} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
          <option value="all">All time</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {sales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No sales in this period"
          description="Record your first sale to start tracking profit."
          action={
            <Button asChild>
              <Link href="/sales/new">New sale</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/sales/${s.id}`} className="hover:underline">
                      {formatDate(s.date)}
                    </Link>
                  </TableCell>
                  <TableCell>{s.contact?.name ?? "Walk-in"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s._count.lines}</TableCell>
                  <TableCell className="text-right">
                    <Money cents={s.revenue} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money cents={s.grossProfit} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MarginBadge margin={marginPct(s.grossProfit, s.revenue)} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
