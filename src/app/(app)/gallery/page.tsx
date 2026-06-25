import { Images } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { GalleryGrid, type GalleryEntry } from "./gallery-grid";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string; category?: string; type?: string }>;
}) {
  const sp = await searchParams;

  const where: Prisma.MediaWhereInput = {
    ...(sp.itemId ? { itemId: sp.itemId } : {}),
    ...(sp.type === "image" || sp.type === "video" ? { type: sp.type } : {}),
    ...(sp.category ? { item: { category: sp.category } } : {}),
  };

  const [media, items, categories] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: [{ itemId: "asc" }, { sortOrder: "asc" }],
      include: { item: { select: { id: true, name: true, category: true, primaryMediaId: true } } },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.item.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] }),
  ]);

  const entries: GalleryEntry[] = media.map((m) => ({
    id: m.id,
    type: m.type,
    filePath: m.filePath,
    webPath: m.webPath,
    thumbnailPath: m.thumbnailPath,
    caption: m.caption,
    alt: m.alt,
    itemId: m.itemId,
    itemName: m.item?.name ?? null,
    category: m.item?.category ?? null,
    isPrimary: m.item?.primaryMediaId === m.id,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Gallery" description={`All product media across the catalog · ${media.length} files`} />

      <form className="flex flex-wrap items-center gap-2">
        <select name="itemId" defaultValue={sp.itemId ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All items</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category!}>
              {c.category}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Images & video</option>
          <option value="image">Images only</option>
          <option value="video">Video only</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No media found"
          description="Upload product photos and videos from any item's detail page."
        />
      ) : (
        <GalleryGrid media={entries} />
      )}
    </div>
  );
}
