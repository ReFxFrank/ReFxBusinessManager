import Link from "next/link";
import { ShoppingBag, Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EmptyState, StockPill } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { ItemFormDialog } from "../inventory/item-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const cat = sp.cat?.trim() ?? "";

  const [suppliers, categoryRows, allItems] = await Promise.all([
    prisma.contact.findMany({
      where: { type: { in: ["supplier", "both"] } },
      select: { id: true, name: true },
    }),
    prisma.item.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    prisma.item.findMany({
      include: { primaryMedia: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const categories = categoryRows
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));

  const ql = q.toLowerCase();
  const items = allItems.filter((item) => {
    if (cat && item.category !== cat) return false;
    if (ql) {
      const matches =
        item.name.toLowerCase().includes(ql) ||
        item.sku.toLowerCase().includes(ql);
      if (!matches) return false;
    }
    return true;
  });

  const chips: { label: string; value: string; href: string }[] = [
    { label: "All", value: "", href: "/products" },
    ...categories.map((c) => ({
      label: c,
      value: c,
      href: `/products?cat=${encodeURIComponent(c)}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <ItemFormDialog suppliers={suppliers} />
      </div>

      <form className="flex items-center gap-2">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <Input name="q" defaultValue={q} placeholder="Search products…" />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
        {chips.map((chip) => {
          const active = cat === chip.value;
          return (
            <Link
              key={chip.value || "all"}
              href={chip.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card text-muted-foreground"
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={q || cat ? "No products match your filters" : "No products yet"}
          description="Add your first product to start building your catalog."
          action={<ItemFormDialog suppliers={suppliers} />}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {items.map((item, i) => {
            const thumb = item.primaryMedia?.thumbnailPath;
            return (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-accent/50",
                  i > 0 && "border-t"
                )}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storage.localUrl(thumb)}
                    alt={item.name}
                    className="h-10 w-10 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatMoney(item.salePrice)}
                  </p>
                </div>
                <StockPill
                  quantity={item.quantity}
                  reorderThreshold={item.reorderThreshold}
                  unit={item.unit}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
