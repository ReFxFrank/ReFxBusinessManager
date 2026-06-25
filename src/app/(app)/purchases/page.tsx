import Link from "next/link";
import { Receipt, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard, Money, StatusBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, number | null> = { "30": 30, "90": 90, "365": 365, all: null };

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const periodKey = sp.period && sp.period in PERIODS ? sp.period : "90";
  const days = PERIODS[periodKey];
  const from = days ? new Date(Date.now() - days * 864e5) : undefined;

  const where: Prisma.PurchaseWhereInput = {
    ...(from ? { date: { gte: from } } : {}),
    ...(sp.status === "paid" || sp.status === "unpaid" ? { status: sp.status } : {}),
  };

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { date: "desc" },
    include: { contact: true, _count: { select: { lines: true } } },
    take: 200,
  });

  const total = purchases.reduce((s, x) => s + x.total, 0);
  const unpaid = purchases.filter((p) => p.status === "unpaid").reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Stock receipts that drive the moving-average cost."
        action={
          <Button asChild>
            <Link href="/purchases/new">
              <Plus /> New purchase
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Purchases (period)" value={String(purchases.length)} />
        <StatCard label="Total cost" value={`$${(total / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
        <StatCard label="Unpaid (payable)" value={`$${(unpaid / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} accent={unpaid > 0 ? "warning" : "default"} />
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

      {purchases.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No purchases in this period"
          description="Record a stock receipt to add inventory and set cost basis."
          action={
            <Button asChild>
              <Link href="/purchases/new">New purchase</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/purchases/${p.id}`} className="hover:underline">
                      {formatDate(p.date)}
                    </Link>
                  </TableCell>
                  <TableCell>{p.contact?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p._count.lines}</TableCell>
                  <TableCell className="text-right">
                    <Money cents={p.total} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
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
