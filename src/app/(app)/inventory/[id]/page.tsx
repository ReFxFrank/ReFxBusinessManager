import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { formatMoney, marginPct, markupPct, formatPct } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MarginBadge, MoneyStat } from "./detail-bits";
import { ItemFormDialog } from "../item-form";
import { StockAdjustDialog } from "./stock-adjust";
import { ItemGallery } from "./item-gallery";
import { DeleteItemButton } from "./delete-item";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      supplier: true,
      media: { orderBy: { sortOrder: "asc" } },
      priceLogs: { orderBy: { changedAt: "desc" }, take: 25 },
      stockMovements: { orderBy: { date: "desc" }, take: 30 },
    },
  });
  if (!item) notFound();

  const [suppliers, connections, soldAgg] = await Promise.all([
    prisma.contact.findMany({
      where: { type: { in: ["supplier", "both"] } },
      select: { id: true, name: true },
    }),
    prisma.socialConnection.findMany({ where: { status: "connected" } }),
    prisma.saleLine.aggregate({ where: { itemId: id }, _sum: { qty: true, lineProfit: true, lineRevenue: true } }),
  ]);

  const profitPerUnit = item.salePrice - item.avgCost;
  const margin = marginPct(profitPerUnit, item.salePrice);
  const markup = markupPct(profitPerUnit, item.avgCost);
  const stockValue = Math.round(item.quantity * item.avgCost);
  const low = item.quantity <= item.reorderThreshold;

  const social = {
    configured: config.meta.configured,
    fbConnected: connections.some((c) => c.provider === "facebook"),
    igConnected: connections.some((c) => c.provider === "instagram"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>
        <div className="flex items-center gap-2">
          <StockAdjustDialog itemId={item.id} unit={item.unit} />
          <ItemFormDialog
            item={{
              id: item.id,
              name: item.name,
              sku: item.sku,
              category: item.category,
              unit: item.unit,
              salePrice: item.salePrice,
              avgCost: item.avgCost,
              quantity: item.quantity,
              reorderThreshold: item.reorderThreshold,
              supplierId: item.supplierId,
              notes: item.notes,
            }}
            suppliers={suppliers}
          />
          <DeleteItemButton itemId={item.id} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
          {item.category && <Badge variant="outline">{item.category}</Badge>}
          {low && <Badge variant="warning">Low stock</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          SKU {item.sku}
          {item.supplier && (
            <>
              {" · Supplier: "}
              <Link href={`/contacts/${item.supplier.id}`} className="hover:underline">
                {item.supplier.name}
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MoneyStat label="On hand" value={`${item.quantity} ${item.unit}`} accent={low ? "warning" : "default"} />
        <MoneyStat label="Avg cost" value={formatMoney(item.avgCost)} />
        <MoneyStat label="Sale price" value={formatMoney(item.salePrice)} />
        <MoneyStat label="Profit / unit" value={formatMoney(profitPerUnit)} accent={profitPerUnit < 0 ? "destructive" : "success"} />
        <MoneyStat label="Margin / Markup" value={`${formatPct(margin)} / ${formatPct(markup)}`} node={<MarginBadge margin={margin} />} />
        <MoneyStat label="Stock value" value={formatMoney(stockValue)} />
      </div>

      {item.notes && <p className="rounded-md border bg-muted/40 p-3 text-sm">{item.notes}</p>}

      {/* Lifetime sales summary */}
      <Card>
        <CardContent className="flex flex-wrap gap-6 p-4 text-sm">
          <div>
            <p className="text-muted-foreground">Lifetime units sold</p>
            <p className="text-lg font-semibold tabular-nums">{soldAgg._sum.qty ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lifetime revenue</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(soldAgg._sum.lineRevenue ?? 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lifetime realized profit</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(soldAgg._sum.lineProfit ?? 0)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Media gallery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGallery
            itemId={item.id}
            itemName={item.name}
            itemPrice={formatMoney(item.salePrice)}
            media={item.media.map((m) => ({
              id: m.id,
              type: m.type,
              filePath: m.filePath,
              webPath: m.webPath,
              thumbnailPath: m.thumbnailPath,
              caption: m.caption,
              alt: m.alt,
              duration: m.duration,
            }))}
            primaryMediaId={item.primaryMediaId}
            social={social}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Price history */}
        <Card>
          <CardHeader>
            <CardTitle>Price history</CardTitle>
          </CardHeader>
          <CardContent>
            {item.priceLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No price changes recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead className="text-right">Old</TableHead>
                    <TableHead className="text-right">New</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.priceLogs.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{formatDate(p.changedAt, true)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.field}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.oldPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.newPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stock movements */}
        <Card>
          <CardHeader>
            <CardTitle>Stock movements</CardTitle>
          </CardHeader>
          <CardContent>
            {item.stockMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.stockMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatDate(m.date, true)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.reason}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.note ?? "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums ${m.change < 0 ? "text-destructive" : "text-success"}`}>
                        {m.change > 0 ? "+" : ""}
                        {m.change}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Costing: moving weighted-average. Sales snapshot the average cost at the moment of sale, so realized profit on past
        sales never changes when later purchases shift the average.
      </p>
    </div>
  );
}
