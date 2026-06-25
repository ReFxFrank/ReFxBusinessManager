import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadDialog } from "./upload-dialog";
import { DocumentRowActions } from "./row-actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const TYPES = ["invoice", "receipt", "contract", "other"] as const;

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type ?? "";

  const where: Prisma.DocumentWhereInput = {
    ...(q ? { title: { contains: q } } : {}),
    ...(type ? { type: type as (typeof TYPES)[number] } : {}),
  };

  const [documents, contacts, items] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      include: { contact: { select: { name: true } }, item: { select: { name: true } } },
    }),
    prisma.contact.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description={`${documents.length} document${documents.length === 1 ? "" : "s"}`}
        action={<UploadDialog contacts={contacts} items={items} />}
      />

      <form className="flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q} placeholder="Search title…" className="max-w-xs" />
        <select
          name="type"
          defaultValue={type}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q || type ? "No documents match your filters" : "No documents yet"}
          description="Upload invoices, receipts, contracts and more."
          action={<UploadDialog contacts={contacts} items={items} />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Linked to</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const url = `/api/files/${encodeURI(doc.filePath)}`;
                const linked = doc.contact?.name ?? doc.item?.name ?? null;
                const isImage = doc.mimeType?.startsWith("image/") ?? false;
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={doc.title}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {doc.title}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{linked ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(doc.fileSize)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(doc.uploadedAt)}
                    </TableCell>
                    <TableCell>
                      <DocumentRowActions id={doc.id} filePath={doc.filePath} />
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
