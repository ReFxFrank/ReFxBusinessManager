import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney, marginPct } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MarginBadge, StatusBadge, Money } from "@/components/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SaleActionsBar } from "./sale-actions-bar";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { contact: true, lines: { include: { item: true } } },
  });
  if (!sale) notFound();

  const margin = marginPct(sale.grossProfit, sale.revenue);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to sales
        </Link>
        <SaleActionsBar saleId={sale.id} status={sale.status} />
      </div>

      {/* Invoice */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">Invoice</CardTitle>
            <p className="text-sm text-muted-foreground">
              #{sale.id.slice(-8).toUpperCase()} · {formatDate(sale.date, true)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">ReFx Business Manager</p>
            <p className="text-sm text-muted-foreground">Inventory · Profit · Media</p>
            <div className="mt-1">
              <StatusBadge status={sale.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Billed to</p>
            <p className="font-medium">{sale.contact?.name ?? "Walk-in customer"}</p>
            {sale.contact?.email && <p className="text-muted-foreground">{sale.contact.email}</p>}
            <p className="text-muted-foreground">Payment method: {sale.paymentMethod ?? "—"}</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead className="text-right print:hidden">Unit cost</TableHead>
                <TableHead className="text-right print:hidden">Profit</TableHead>
                <TableHead className="text-right print:hidden">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link href={`/inventory/${l.itemId}`} className="font-medium hover:underline">
                      {l.item.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{l.item.sku}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.qty} {l.item.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(l.unitSalePrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(l.lineRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground print:hidden">
                    {formatMoney(l.unitCostSnapshot)}
                  </TableCell>
                  <TableCell className="text-right print:hidden">
                    <Money cents={l.lineProfit} />
                  </TableCell>
                  <TableCell className="text-right print:hidden">
                    <MarginBadge margin={marginPct(l.lineProfit, l.lineRevenue)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator />

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <Row label="Revenue" value={formatMoney(sale.revenue)} bold />
            <Row label="Cost of goods sold" value={formatMoney(sale.cogs)} muted className="print:hidden" />
            <Row label="Gross profit" value={formatMoney(sale.grossProfit)} className="print:hidden" />
            <div className="flex items-center justify-between print:hidden">
              <span className="text-muted-foreground">Margin</span>
              <MarginBadge margin={margin} />
            </div>
            <Separator className="my-1" />
            <Row label="Total due" value={formatMoney(sale.revenue)} bold />
          </div>

          {sale.notes && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              <span className="font-medium">Notes: </span>
              {sale.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
