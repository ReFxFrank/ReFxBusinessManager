"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseMoney } from "@/lib/money";
import { recordSale, checkOversell, OversellError } from "@/lib/inventory";
import type { PaymentStatus } from "@prisma/client";

export type SaleActionState = {
  ok: boolean;
  error?: string;
  oversell?: { name: string; requested: number; available: number }[];
  saleId?: string;
};

interface RawLine {
  itemId: string;
  qty: string;
  unitSalePrice: string;
}

interface SalePayload {
  contactId?: string;
  date: string;
  status: PaymentStatus;
  paymentMethod: string;
  notes?: string;
  allowOversell: boolean;
  lines: RawLine[];
}

export async function submitSale(payload: SalePayload): Promise<SaleActionState> {
  const lines = payload.lines
    .filter((l) => l.itemId && Number(l.qty) > 0)
    .map((l) => ({
      itemId: l.itemId,
      qty: Number(l.qty),
      unitSalePrice: parseMoney(l.unitSalePrice),
    }));

  if (lines.length === 0) return { ok: false, error: "Add at least one line item." };

  // Pre-check overselling so the UI can warn before committing.
  if (!payload.allowOversell) {
    const problems = await checkOversell(lines);
    if (problems.length > 0) {
      return {
        ok: false,
        error: "Some lines exceed available stock.",
        oversell: problems.map((p) => ({ name: p.name, requested: p.requested, available: p.available })),
      };
    }
  }

  try {
    const sale = await recordSale({
      contactId: payload.contactId || null,
      date: new Date(payload.date),
      status: payload.status,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes || null,
      lines,
      allowOversell: payload.allowOversell,
    });
    revalidatePath("/sales");
    revalidatePath("/inventory");
    revalidatePath("/");
    return { ok: true, saleId: sale.id };
  } catch (e) {
    if (e instanceof OversellError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record sale." };
  }
}

export async function setSaleStatus(saleId: string, status: PaymentStatus) {
  await prisma.sale.update({ where: { id: saleId }, data: { status } });
  revalidatePath("/sales");
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/");
}
