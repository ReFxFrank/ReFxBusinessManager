import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseStatusToggle } from "./purchase-status";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { contact: true, lines: { include: { item: true } } },
  });
  if (!purchase) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to purchases
        </Link>
        <PurchaseStatusToggle purchaseId={purchase.id} status={purchase.status} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">Purchase #{purchase.id.slice(-8).toUpperCase()}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatDate(purchase.date, true)} · Supplier: {purchase.contact?.name ?? "—"}
            </p>
          </div>
          <StatusBadge status={purchase.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.lines.map((l) => (
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
                  <TableCell className="text-right tabular-nums">{formatMoney(l.unitCost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(l.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="ml-auto flex w-full max-w-xs items-center justify-between text-sm">
            <span className="font-medium">Total cost</span>
            <span className="font-semibold tabular-nums">{formatMoney(purchase.total)}</span>
          </div>
          {purchase.notes && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              <span className="font-medium">Notes: </span>
              {purchase.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
