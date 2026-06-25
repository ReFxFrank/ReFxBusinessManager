"use client";
import * as React from "react";
import Link from "next/link";
import { Play, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface GalleryEntry {
  id: string;
  type: "image" | "video";
  filePath: string;
  webPath: string | null;
  thumbnailPath: string | null;
  caption: string | null;
  alt: string | null;
  itemId: string | null;
  itemName: string | null;
  category: string | null;
  isPrimary: boolean;
}

const fileUrl = (key: string | null) => (key ? `/api/files/${encodeURI(key)}` : "");

export function GalleryGrid({ media }: { media: GalleryEntry[] }) {
  const [active, setActive] = React.useState<GalleryEntry | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {media.map((m) => {
          const thumb = m.thumbnailPath ?? m.webPath ?? m.filePath;
          return (
            <button
              key={m.id}
              onClick={() => setActive(m)}
              className="group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(thumb)} alt={m.alt ?? ""} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Play className="h-8 w-8" />
                </div>
              )}
              {m.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-black/50 p-2">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                </div>
              )}
              {m.isPrimary && (
                <Badge variant="success" className="absolute left-1.5 top-1.5">
                  Primary
                </Badge>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="truncate text-xs font-medium text-white">{m.itemName ?? "Unassigned"}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{active?.caption || active?.itemName || "Media"}</DialogTitle>
          </DialogHeader>
          {active?.type === "video" ? (
            <video src={fileUrl(active.filePath)} controls className="max-h-[65vh] w-full rounded-md" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(active?.webPath ?? active?.filePath ?? null)} alt={active?.alt ?? ""} className="max-h-[65vh] w-full rounded-md object-contain" />
          )}
          {active?.itemId && (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={`/inventory/${active.itemId}`}>
                <ExternalLink className="h-4 w-4" /> View item
              </Link>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
