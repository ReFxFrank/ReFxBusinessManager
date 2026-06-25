"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Field } from "@/app/(app)/inventory/item-form";

const TYPES = ["invoice", "receipt", "contract", "other"] as const;

interface NamedRef {
  id: string;
  name: string;
}

export function UploadDialog({
  contacts,
  items,
  trigger,
}: {
  contacts: NamedRef[];
  items: NamedRef[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<(typeof TYPES)[number]>("other");
  const [notes, setNotes] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [itemId, setItemId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setType("other");
    setNotes("");
    setContactId("");
    setItemId("");
    setError(null);
    setProgress(0);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("A file is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("type", type);
    fd.append("notes", notes);
    fd.append("contactId", contactId);
    fd.append("itemId", itemId);

    setUploading(true);
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      let body: { ok?: boolean; id?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        // ignore parse errors; handled below
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.ok) {
        toast({ title: "Document uploaded", variant: "success" });
        reset();
        setOpen(false);
        router.refresh();
      } else {
        const msg = body.error ?? "Upload failed. Please try again.";
        setError(msg);
        toast({ title: msg, variant: "destructive" });
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      const msg = "Upload failed. Please try again.";
      setError(msg);
      toast({ title: msg, variant: "destructive" });
    };

    xhr.send(fd);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!uploading) setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload /> Upload document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="File">
            <Input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) {
                  setTitle(f.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
          </Field>
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. March invoice"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as (typeof TYPES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Link to contact">
              <Select
                value={contactId || "none"}
                onValueChange={(v) => setContactId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Link to item">
            <Select value={itemId || "none"} onValueChange={(v) => setItemId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>

          {uploading && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={uploading}>
              {uploading ? `Uploading… ${progress}%` : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
