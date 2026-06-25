import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Sanitize a filename to a storage-safe segment. */
function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\]+/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "file";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const typeRaw = String(form.get("type") ?? "other");
    const type = (["invoice", "receipt", "contract", "other"] as const).includes(
      typeRaw as "invoice" | "receipt" | "contract" | "other",
    )
      ? (typeRaw as "invoice" | "receipt" | "contract" | "other")
      : "other";

    const notes = String(form.get("notes") ?? "").trim();
    const contactId = String(form.get("contactId") ?? "").trim();
    const itemId = String(form.get("itemId") ?? "").trim();
    const saleId = String(form.get("saleId") ?? "").trim();
    const purchaseId = String(form.get("purchaseId") ?? "").trim();

    const id = randomUUID();
    const key = `documents/${id}/${safeFileName(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.put(key, buffer);

    const created = await prisma.document.create({
      data: {
        id,
        title,
        type,
        filePath: key,
        mimeType: file.type || null,
        fileSize: buffer.length,
        notes: notes || null,
        contactId: contactId || null,
        itemId: itemId || null,
        saleId: saleId || null,
        purchaseId: purchaseId || null,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("Document upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
