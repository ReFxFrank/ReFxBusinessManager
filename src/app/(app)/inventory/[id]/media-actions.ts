"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteMediaFiles } from "@/lib/media";

export async function setPrimaryMedia(itemId: string, mediaId: string) {
  await prisma.item.update({ where: { id: itemId }, data: { primaryMediaId: mediaId } });
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/inventory");
  revalidatePath("/gallery");
}

export async function updateMediaCaption(
  itemId: string,
  mediaId: string,
  caption: string,
  alt: string,
) {
  await prisma.media.update({ where: { id: mediaId }, data: { caption, alt } });
  revalidatePath(`/inventory/${itemId}`);
}

export async function deleteMedia(itemId: string, mediaId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return;

  // If it was the primary, clear/repoint it.
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (item?.primaryMediaId === mediaId) {
    const next = await prisma.media.findFirst({
      where: { itemId, type: "image", NOT: { id: mediaId } },
      orderBy: { sortOrder: "asc" },
    });
    await prisma.item.update({
      where: { id: itemId },
      data: { primaryMediaId: next?.id ?? null },
    });
  }

  await prisma.media.delete({ where: { id: mediaId } });
  await deleteMediaFiles([media.filePath, media.webPath, media.thumbnailPath]);
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/inventory");
  revalidatePath("/gallery");
}

/** Persist a new ordering (array of media ids in display order). */
export async function reorderMedia(itemId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.media.update({ where: { id }, data: { sortOrder: idx } }),
    ),
  );
  revalidatePath(`/inventory/${itemId}`);
}
