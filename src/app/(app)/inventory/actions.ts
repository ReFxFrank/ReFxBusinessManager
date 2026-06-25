"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseMoney } from "@/lib/money";
import { autoSku } from "@/lib/utils";
import { itemSchema, adjustStockSchema } from "@/lib/validation";
import { adjustStock, updateItemPrices } from "@/lib/inventory";

export type ActionState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodToState(error: import("zod").ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}

export async function createItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  const sku = v.sku?.trim() || autoSku(v.name);
  const existing = await prisma.item.findUnique({ where: { sku } });
  if (existing) return { ok: false, fieldErrors: { sku: "SKU already exists" }, error: "Duplicate SKU." };

  await prisma.item.create({
    data: {
      name: v.name,
      sku,
      category: v.category || null,
      unit: v.unit,
      salePrice: parseMoney(v.salePrice),
      avgCost: v.avgCost ? parseMoney(v.avgCost) : 0,
      quantity: v.quantity,
      reorderThreshold: v.reorderThreshold,
      supplierId: v.supplierId || null,
      notes: v.notes || null,
    },
  });

  revalidatePath("/inventory");
  return { ok: true };
}

export async function updateItem(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  const sku = v.sku?.trim() || autoSku(v.name);
  const dupe = await prisma.item.findFirst({ where: { sku, NOT: { id } } });
  if (dupe) return { ok: false, fieldErrors: { sku: "SKU already exists" }, error: "Duplicate SKU." };

  await prisma.$transaction(async (tx) => {
    const salePrice = parseMoney(v.salePrice);
    const avgCost = v.avgCost ? parseMoney(v.avgCost) : undefined;
    await updateItemPrices(id, tx, { salePrice, avgCost }, "Edited from item form");
    await tx.item.update({
      where: { id },
      data: {
        name: v.name,
        sku,
        category: v.category || null,
        unit: v.unit,
        salePrice,
        ...(avgCost !== undefined ? { avgCost } : {}),
        reorderThreshold: v.reorderThreshold,
        supplierId: v.supplierId || null,
        notes: v.notes || null,
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { ok: true };
}

export async function deleteItem(id: string): Promise<void> {
  // Block deletion if the item has sales/purchases (preserve profit history).
  const refs = await prisma.item.findUnique({
    where: { id },
    select: { _count: { select: { saleLines: true, purchaseLines: true } } },
  });
  if (refs && (refs._count.saleLines > 0 || refs._count.purchaseLines > 0)) {
    throw new Error("Cannot delete an item with sales or purchase history. Archive it instead.");
  }
  await prisma.item.update({ where: { id }, data: { primaryMediaId: null } });
  await prisma.item.delete({ where: { id } });
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function adjustItemStock(itemId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = adjustStockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  await adjustStock(itemId, parsed.data.change, parsed.data.reason, parsed.data.reason);
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/inventory");
  return { ok: true };
}
