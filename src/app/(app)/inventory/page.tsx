import Link from "next/link";
import { Package, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { formatMoney, marginPct } from "@/lib/money";
import { PageHeader, EmptyState, MarginBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemFormDialog } from "./item-form";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const category = sp.category ?? "";
  const sort = sp.sort ?? "name";

  const where: Prisma.ItemWhereInput = {
    ...(q
      ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { notes: { contains: q } }] }
      : {}),
    ...(category ? { category } : {}),
  };

  const orderBy: Prisma.ItemOrderByWithRelationInput =
    sort === "quantity"
      ? { quantity: "asc" }
      : sort === "value"
        ? { avgCost: "desc" }
        : sort === "price"
          ? { salePrice: "desc" }
          : { name: "asc" };

  const [items, categories, suppliers] = await Promise.all([
    prisma.item.findMany({ where, orderBy, include: { primaryMedia: true, supplier: true } }),
    prisma.item.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] }),
    prisma.contact.findMany({ where: { type: { in: ["supplier", "both"] } }, select: { id: true, name: true } }),
  ]);

  const totalValue = items.reduce((s, i) => s + Math.round(i.quantity * i.avgCost), 0);
  const lowStockCount = items.filter((i) => i.quantity <= i.reorderThreshold).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${items.length} items · ${formatMoney(totalValue)} stock value · ${lowStockCount} low-stock`}
        action={<ItemFormDialog suppliers={suppliers} />}
      />

      <form className="flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name, SKU, notes…" className="max-w-xs" />
        <select
          name="category"
          defaultValue={category}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category!}>
              {c.category}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="name">Sort: Name</option>
          <option value="quantity">Sort: Quantity (low→high)</option>
          <option value="price">Sort: Sale price</option>
          <option value="value">Sort: Avg cost</option>
        </select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q || category ? "No items match your filters" : "No items yet"}
          description="Add your first item to start tracking stock and profit."
          action={<ItemFormDialog suppliers={suppliers} />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">Sale price</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const low = item.quantity <= item.reorderThreshold;
                const margin = marginPct(item.salePrice - item.avgCost, item.salePrice);
                const thumb = item.primaryMedia?.thumbnailPath;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`}>
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={storage.localUrl(thumb)}
                            alt={item.name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.sku}</span>
                        {item.category && <Badge variant="outline">{item.category}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        {low && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </Badge>
                        )}
                        <span>
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(item.avgCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(item.salePrice)}</TableCell>
                    <TableCell className="text-right">
                      <MarginBadge margin={margin} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(Math.round(item.quantity * item.avgCost))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
