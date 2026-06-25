/**
 * Core inventory/profit engine — the spine of the app.
 *
 *  * Stock receipts (purchases) recompute the item's MOVING WEIGHTED-AVERAGE
 *    unit cost.
 *  * Sales snapshot the current average cost onto each SaleLine
 *    (`unitCostSnapshot`) so realized profit is locked in and never changes
 *    when later purchases shift the average.
 *
 * All money is integer cents. Quantities may be fractional (kg/m/L).
 */

import { prisma } from "./prisma";
import { computeLine } from "./money";
import type { Prisma, PaymentStatus } from "@prisma/client";

/**
 * Moving weighted-average cost.
 *   newAvg = (oldQty * oldAvg + recvQty * unitCost) / (oldQty + recvQty)
 * Guarded so a zero/negative on-hand base falls back to the incoming cost.
 */
export function movingAverage(
  oldQty: number,
  oldAvg: number,
  recvQty: number,
  unitCost: number,
): number {
  const base = Math.max(0, oldQty);
  const denom = base + recvQty;
  if (denom <= 0) return unitCost;
  if (base <= 0) return unitCost;
  return Math.round((base * oldAvg + recvQty * unitCost) / denom);
}

export interface PurchaseLineInput {
  itemId: string;
  qty: number;
  unitCost: number; // cents
}

export interface RecordPurchaseInput {
  contactId?: string | null;
  date?: Date;
  status?: PaymentStatus;
  notes?: string | null;
  lines: PurchaseLineInput[];
}

export async function recordPurchase(input: RecordPurchaseInput) {
  if (input.lines.length === 0) throw new Error("A purchase needs at least one line item.");

  return prisma.$transaction(async (tx) => {
    let total = 0;
    const purchase = await tx.purchase.create({
      data: {
        contactId: input.contactId ?? null,
        date: input.date ?? new Date(),
        status: input.status ?? "paid",
        notes: input.notes ?? null,
        total: 0,
      },
    });

    for (const line of input.lines) {
      const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
      const lineTotal = Math.round(line.qty * line.unitCost);
      total += lineTotal;

      const newAvg = movingAverage(item.quantity, item.avgCost, line.qty, line.unitCost);

      await tx.purchaseLine.create({
        data: {
          purchaseId: purchase.id,
          itemId: item.id,
          qty: line.qty,
          unitCost: line.unitCost,
          lineTotal,
        },
      });

      await tx.item.update({
        where: { id: item.id },
        data: { quantity: { increment: line.qty }, avgCost: newAvg },
      });

      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          change: line.qty,
          reason: "purchase",
          date: input.date ?? new Date(),
          purchaseId: purchase.id,
        },
      });

      if (newAvg !== item.avgCost) {
        await tx.priceLog.create({
          data: {
            itemId: item.id,
            field: "cost",
            oldPrice: item.avgCost,
            newPrice: newAvg,
            note: "Moving-average recompute on stock receipt",
          },
        });
      }
    }

    return tx.purchase.update({ where: { id: purchase.id }, data: { total } });
  });
}

export interface SaleLineInput {
  itemId: string;
  qty: number;
  unitSalePrice: number; // cents
}

export interface RecordSaleInput {
  contactId?: string | null;
  date?: Date;
  status?: PaymentStatus;
  paymentMethod?: string | null;
  notes?: string | null;
  lines: SaleLineInput[];
  /** When false (default), overselling is blocked with an error. */
  allowOversell?: boolean;
}

/** Check stock availability without mutating; returns lines that would oversell. */
export async function checkOversell(lines: SaleLineInput[]) {
  const problems: { itemId: string; name: string; requested: number; available: number }[] = [];
  for (const line of lines) {
    const item = await prisma.item.findUnique({ where: { id: line.itemId } });
    if (!item) continue;
    if (line.qty > item.quantity) {
      problems.push({
        itemId: item.id,
        name: item.name,
        requested: line.qty,
        available: item.quantity,
      });
    }
  }
  return problems;
}

export async function recordSale(input: RecordSaleInput) {
  if (input.lines.length === 0) throw new Error("A sale needs at least one line item.");

  return prisma.$transaction(async (tx) => {
    // Validate stock first (block overselling unless explicitly allowed).
    if (!input.allowOversell) {
      for (const line of input.lines) {
        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
        if (line.qty > item.quantity) {
          throw new OversellError(
            `Not enough stock for "${item.name}": requested ${line.qty}, available ${item.quantity}.`,
          );
        }
      }
    }

    const sale = await tx.sale.create({
      data: {
        contactId: input.contactId ?? null,
        date: input.date ?? new Date(),
        status: input.status ?? "paid",
        paymentMethod: input.paymentMethod ?? "cash",
        notes: input.notes ?? null,
      },
    });

    let revenue = 0;
    let cogs = 0;
    let grossProfit = 0;

    for (const line of input.lines) {
      const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
      // SNAPSHOT the current moving-average cost — locks in realized profit.
      const unitCostSnapshot = item.avgCost;
      const { lineRevenue, lineCogs, lineProfit } = computeLine(
        line.qty,
        line.unitSalePrice,
        unitCostSnapshot,
      );

      revenue += lineRevenue;
      cogs += lineCogs;
      grossProfit += lineProfit;

      await tx.saleLine.create({
        data: {
          saleId: sale.id,
          itemId: item.id,
          qty: line.qty,
          unitSalePrice: line.unitSalePrice,
          unitCostSnapshot,
          lineRevenue,
          lineCogs,
          lineProfit,
        },
      });

      await tx.item.update({
        where: { id: item.id },
        data: { quantity: { decrement: line.qty } },
      });

      await tx.stockMovement.create({
        data: {
          itemId: item.id,
          change: -line.qty,
          reason: "sale",
          date: input.date ?? new Date(),
          saleId: sale.id,
        },
      });
    }

    return tx.sale.update({
      where: { id: sale.id },
      data: { revenue, cogs, grossProfit },
      include: { lines: { include: { item: true } }, contact: true },
    });
  });
}

/** Manual stock adjustment (+/-) with a reason. Does not change avgCost. */
export async function adjustStock(
  itemId: string,
  change: number,
  reason: string,
  note?: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.item.update({ where: { id: itemId }, data: { quantity: { increment: change } } });
    return tx.stockMovement.create({
      data: { itemId, change, reason: "adjustment", note: note ?? reason },
    });
  });
}

/** Update an item's sale price and/or cost, logging price changes. */
export async function updateItemPrices(
  itemId: string,
  tx: Prisma.TransactionClient,
  updates: { salePrice?: number; avgCost?: number },
  note?: string,
) {
  const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
  if (updates.salePrice !== undefined && updates.salePrice !== item.salePrice) {
    await tx.priceLog.create({
      data: {
        itemId,
        field: "sale",
        oldPrice: item.salePrice,
        newPrice: updates.salePrice,
        note: note ?? "Manual price change",
      },
    });
  }
  if (updates.avgCost !== undefined && updates.avgCost !== item.avgCost) {
    await tx.priceLog.create({
      data: {
        itemId,
        field: "cost",
        oldPrice: item.avgCost,
        newPrice: updates.avgCost,
        note: note ?? "Manual cost change",
      },
    });
  }
}

export class OversellError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OversellError";
  }
}
