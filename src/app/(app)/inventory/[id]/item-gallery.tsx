"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Star,
  Trash2,
  GripVertical,
  Play,
  Share2,
  Pencil,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ShareDialog } from "@/components/share-dialog";
import { cn } from "@/lib/utils";
import {
  setPrimaryMedia,
  deleteMedia,
  updateMediaCaption,
  reorderMedia,
} from "./media-actions";

export interface GalleryMedia {
  id: string;
  type: "image" | "video";
  filePath: string;
  webPath: string | null;
  thumbnailPath: string | null;
  caption: string | null;
  alt: string | null;
  duration: number | null;
}

const fileUrl = (key: string | null) => (key ? `/api/files/${encodeURI(key)}` : "");

export function ItemGallery({
  itemId,
  itemName,
  itemPrice,
  media,
  primaryMediaId,
  social,
}: {
  itemId: string;
  itemName: string;
  itemPrice: string;
  media: GalleryMedia[];
  primaryMediaId: string | null;
  social: { configured: boolean; fbConnected: boolean; igConnected: boolean };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = React.useState(media);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<GalleryMedia | null>(null);
  const [editing, setEditing] = React.useState<GalleryMedia | null>(null);
  const dragId = React.useRef<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setItems(media), [media]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    for (const file of list) {
      await new Promise<void>((resolve) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("itemId", itemId);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/media");
        setUploading(true);
        setProgress(0);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            toast({ title: `Uploaded ${file.name}`, variant: "success" });
          } else {
            let msg = "Upload failed";
            try {
              msg = JSON.parse(xhr.responseText).error ?? msg;
            } catch {}
            toast({ title: msg, variant: "destructive" });
          }
          resolve();
        };
        xhr.onerror = () => {
          toast({ title: "Upload failed", variant: "destructive" });
          resolve();
        };
        xhr.send(fd);
      });
    }
    setUploading(false);
    setProgress(0);
    router.refresh();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  // --- reordering ---
  function onItemDragStart(id: string) {
    dragId.current = id;
  }
  function onItemDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    setItems((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((m) => m.id === from);
      const toIdx = arr.findIndex((m) => m.id === overId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  }
  async function onItemDrop() {
    dragId.current = null;
    await reorderMedia(itemId, items.map((m) => m.id));
    toast({ title: "Order saved", variant: "success" });
  }

  async function makePrimary(id: string) {
    await setPrimaryMedia(itemId, id);
    toast({ title: "Primary image set", variant: "success" });
    router.refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this media? This cannot be undone.")) return;
    await deleteMedia(itemId, id);
    toast({ title: "Media deleted", variant: "success" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-6 text-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="font-medium">Drag & drop images or videos here</p>
        <p className="text-xs text-muted-foreground">or click to browse · images & video supported</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploading && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          No media yet — add some above.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((m) => {
            const isPrimary = m.id === primaryMediaId;
            const thumb = m.thumbnailPath ?? m.webPath ?? m.filePath;
            return (
              <div
                key={m.id}
                draggable
                onDragStart={() => onItemDragStart(m.id)}
                onDragOver={(e) => onItemDragOver(e, m.id)}
                onDrop={onItemDrop}
                className="group relative overflow-hidden rounded-lg border bg-card"
              >
                <div
                  className="relative aspect-square cursor-pointer bg-muted"
                  onClick={() => setLightbox(m)}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(thumb)} alt={m.alt ?? ""} className="h-full w-full object-cover" />
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
                  {isPrimary && (
                    <Badge variant="success" className="absolute left-1.5 top-1.5 gap-1">
                      <Star className="h-3 w-3" /> Primary
                    </Badge>
                  )}
                  <div className="absolute right-1.5 top-1.5 cursor-grab opacity-0 transition-opacity group-hover:opacity-100">
                    <GripVertical className="h-4 w-4 text-white drop-shadow" />
                  </div>
                </div>
                {m.caption && <p className="truncate px-2 py-1 text-xs text-muted-foreground">{m.caption}</p>}
                <div className="flex items-center justify-between border-t px-1 py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Set as primary"
                    disabled={isPrimary || m.type !== "image"}
                    onClick={() => makePrimary(m.id)}
                  >
                    <Star className={cn("h-4 w-4", isPrimary && "fill-current")} />
                  </Button>
                  <ShareDialog
                    mediaId={m.id}
                    defaultCaption={`${itemName} — ${itemPrice}`}
                    configured={social.configured}
                    fbConnected={social.fbConnected}
                    igConnected={social.igConnected}
                    trigger={
                      <Button variant="ghost" size="icon" title="Share">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="icon" title="Edit caption" onClick={() => setEditing(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{lightbox?.caption || itemName}</DialogTitle>
          </DialogHeader>
          {lightbox?.type === "video" ? (
            <video src={fileUrl(lightbox.filePath)} controls className="max-h-[70vh] w-full rounded-md" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl(lightbox?.webPath ?? lightbox?.filePath ?? null)}
              alt={lightbox?.alt ?? ""}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Caption editor */}
      <CaptionEditor
        media={editing}
        itemId={itemId}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function CaptionEditor({
  media,
  itemId,
  onClose,
  onSaved,
}: {
  media: GalleryMedia | null;
  itemId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [caption, setCaption] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    setCaption(media?.caption ?? "");
    setAlt(media?.alt ?? "");
  }, [media]);

  return (
    <Dialog open={!!media} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit caption & alt text</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Caption</label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Alt text (accessibility)</label>
            <Textarea value={alt} onChange={(e) => setAlt(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              media &&
              start(async () => {
                await updateMediaCaption(itemId, media.id, caption, alt);
                toast({ title: "Saved", variant: "success" });
                onClose();
                onSaved();
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
