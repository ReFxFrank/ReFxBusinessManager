import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { EmptyState, StockPill } from "@/components/shared";
import { Segmented } from "@/components/segmented";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const SEGS = ["all", "low", "out"] as const;
type Seg = (typeof SEGS)[number];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seg?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const seg: Seg = (SEGS.includes(sp.seg as Seg) ? sp.seg : "all") as Seg;

  const items = await prisma.item.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] }
      : undefined,
    include: { primaryMedia: true },
    orderBy: { quantity: "asc" },
  });

  const filtered = items.filter((item) => {
    if (seg === "low") return item.quantity > 0 && item.quantity <= item.reorderThreshold;
    if (seg === "out") return item.quantity <= 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </p>
      </div>

      <form className="space-y-3">
        <input type="hidden" name="seg" value={seg} />
        <Input name="q" defaultValue={q} placeholder="Search inventory…" />
      </form>

      <Segmented
        param="seg"
        value={seg}
        options={[
          { value: "all", label: "All Items" },
          { value: "low", label: "Low Stock" },
          { value: "out", label: "Out of Stock" },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q || seg !== "all" ? "No items match" : "No items yet"}
          description={
            q || seg !== "all"
              ? "Try a different search or segment."
              : "Add your first item to start tracking stock."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {filtered.map((item, i) => {
            const thumb = item.primaryMedia?.thumbnailPath;
            return (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/50 ${i > 0 ? "border-t" : ""}`}
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
                  <p className="truncate text-xs text-muted-foreground">{item.sku}</p>
                </div>
                <StockPill
                  quantity={item.quantity}
                  reorderThreshold={item.reorderThreshold}
                  unit={item.unit}
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
