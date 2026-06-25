"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

export async function deleteDocument(id: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return;
  await storage.delete(doc.filePath);
  await prisma.document.delete({ where: { id } });
  revalidatePath("/documents");
}
