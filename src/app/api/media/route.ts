import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { processUpload } from "@/lib/media";

export const runtime = "nodejs";

/**
 * Upload one media file (image or video) and attach it to an item.
 * Multipart form fields: file, itemId.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const itemId = String(form.get("itemId") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId." }, { status: 400 });
    }
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Create the row first so we have an id to namespace the storage key.
    const media = await prisma.media.create({
      data: {
        itemId,
        type: file.type.startsWith("video") ? "video" : "image",
        filePath: "",
        mimeType: file.type,
        fileSize: buffer.length,
        sortOrder: (await prisma.media.count({ where: { itemId } })) + 1,
      },
    });

    let processed;
    try {
      processed = await processUpload(media.id, buffer, file.type, file.name);
    } catch (err) {
      await prisma.media.delete({ where: { id: media.id } });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to process file." },
        { status: 400 },
      );
    }

    const updated = await prisma.media.update({
      where: { id: media.id },
      data: {
        type: processed.type,
        filePath: processed.filePath,
        webPath: processed.webPath,
        thumbnailPath: processed.thumbnailPath,
        mimeType: processed.mimeType,
        fileSize: processed.fileSize,
        width: processed.width,
        height: processed.height,
        duration: processed.duration,
        alt: item.name,
      },
    });

    // If the item has no primary image yet and this is an image, make it primary.
    if (!item.primaryMediaId && processed.type === "image") {
      await prisma.item.update({ where: { id: itemId }, data: { primaryMediaId: media.id } });
    }

    return NextResponse.json({ ok: true, media: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}
