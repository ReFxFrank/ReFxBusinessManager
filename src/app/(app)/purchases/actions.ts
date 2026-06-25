"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseMoney } from "@/lib/money";
import { recordPurchase } from "@/lib/inventory";
import type { PaymentStatus } from "@prisma/client";

export type PurchaseActionState = { ok: boolean; error?: string; purchaseId?: string };

interface RawLine {
  itemId: string;
  qty: string;
  unitCost: string;
}

interface PurchasePayload {
  contactId?: string;
  date: string;
  status: PaymentStatus;
  notes?: string;
  lines: RawLine[];
}

export async function submitPurchase(payload: PurchasePayload): Promise<PurchaseActionState> {
  const lines = payload.lines
    .filter((l) => l.itemId && Number(l.qty) > 0)
    .map((l) => ({ itemId: l.itemId, qty: Number(l.qty), unitCost: parseMoney(l.unitCost) }));

  if (lines.length === 0) return { ok: false, error: "Add at least one line item." };

  try {
    const purchase = await recordPurchase({
      contactId: payload.contactId || null,
      date: new Date(payload.date),
      status: payload.status,
      notes: payload.notes || null,
      lines,
    });
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    revalidatePath("/");
    return { ok: true, purchaseId: purchase.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record purchase." };
  }
}

export async function setPurchaseStatus(purchaseId: string, status: PaymentStatus) {
  await prisma.purchase.update({ where: { id: purchaseId }, data: { status } });
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/");
}
