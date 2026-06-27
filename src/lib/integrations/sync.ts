/**
 * Sync orchestration — platform-agnostic.
 *
 * IMPORT: normalized products/customers/orders are upserted into Item / Contact
 * / Sale, deduped via the ExternalLink table (provider + entityType + externalId),
 * with every action written to SyncLog.
 * EXPORT (two-way): push a local Item out to the platform and reconcile stock.
 *
 * Money is integer cents. Imported orders snapshot COGS from the item's current
 * avgCost (which is 0 until you record cost), and do NOT decrement stock —
 * platform fulfilment already did, and inventory is reconciled separately.
 */

import { prisma } from "../prisma";
import { autoSku } from "../utils";
import { computeLine } from "../money";
import { ShopifyClient } from "./shopify";
import { EtsyClient } from "./etsy";
import {
  IntegrationError,
  type ConnectionContext,
  type IntegrationProvider,
  type IntegrationProviderId,
  type NormalizedCustomer,
  type NormalizedOrder,
  type NormalizedProduct,
} from "./types";
import type { IntegrationConnection } from "@prisma/client";

export function buildClient(conn: IntegrationConnection): IntegrationProvider {
  const ctx: ConnectionContext = {
    provider: conn.provider as IntegrationProviderId,
    shopDomain: conn.shopDomain,
    externalShopId: conn.externalShopId,
    accessToken: conn.accessToken,
    locationId: conn.locationId,
  };
  if (conn.provider === "shopify") return new ShopifyClient(ctx);
  if (conn.provider === "etsy") return new EtsyClient(ctx);
  throw new IntegrationError(`Unknown provider: ${conn.provider}`);
}

async function log(
  provider: string,
  direction: "import" | "export",
  entityType: string,
  action: string,
  status: "ok" | "error",
  opts: { message?: string; externalId?: string; entityId?: string } = {},
) {
  await prisma.syncLog.create({
    data: { provider, direction, entityType, action, status, ...opts },
  });
}

async function findLink(provider: string, entityType: string, externalId: string) {
  return prisma.externalLink.findUnique({
    where: { provider_entityType_externalId: { provider, entityType, externalId } },
  });
}

async function linkEntity(
  provider: string,
  entityType: string,
  entityId: string,
  externalId: string,
  externalUrl?: string | null,
) {
  await prisma.externalLink.upsert({
    where: { provider_entityType_externalId: { provider, entityType, externalId } },
    update: { entityId, externalUrl: externalUrl ?? undefined, lastSyncedAt: new Date() },
    create: { provider, entityType, entityId, externalId, externalUrl: externalUrl ?? undefined },
  });
}

// --- IMPORT ----------------------------------------------------------------

export async function upsertProduct(provider: string, np: NormalizedProduct) {
  const existing = await findLink(provider, "item", np.externalId);
  if (existing) {
    await prisma.item.update({
      where: { id: existing.entityId },
      data: { name: np.title, salePrice: np.price, category: np.category ?? undefined },
    });
    await linkEntity(provider, "item", existing.entityId, np.externalId, np.url);
    await log(provider, "import", "item", "updated", "ok", { externalId: np.externalId, entityId: existing.entityId });
    return existing.entityId;
  }
  // Link to an existing item by SKU if one matches, else create a new item.
  let item = np.sku ? await prisma.item.findUnique({ where: { sku: np.sku } }) : null;
  if (!item) {
    item = await prisma.item.create({
      data: {
        name: np.title,
        sku: np.sku || autoSku(np.title),
        salePrice: np.price,
        quantity: np.quantity,
        category: np.category,
        source: provider,
      },
    });
    await log(provider, "import", "item", "created", "ok", { externalId: np.externalId, entityId: item.id });
  } else {
    await log(provider, "import", "item", "updated", "ok", { externalId: np.externalId, entityId: item.id });
  }
  await linkEntity(provider, "item", item.id, np.externalId, np.url);
  return item.id;
}

export async function upsertCustomer(provider: string, nc: NormalizedCustomer) {
  const existing = await findLink(provider, "contact", nc.externalId);
  if (existing) return existing.entityId;
  let contact = nc.email ? await prisma.contact.findFirst({ where: { email: nc.email } }) : null;
  if (!contact) {
    contact = await prisma.contact.create({
      data: { name: nc.name, email: nc.email, phone: nc.phone, type: "customer", source: provider },
    });
  }
  await linkEntity(provider, "contact", contact.id, nc.externalId);
  return contact.id;
}

export async function upsertOrder(provider: string, no: NormalizedOrder) {
  const existing = await findLink(provider, "sale", no.externalId);
  if (existing) {
    await log(provider, "import", "sale", "skipped", "ok", { externalId: no.externalId, entityId: existing.entityId, message: "Already imported" });
    return existing.entityId;
  }

  const contactId = no.customer ? await upsertCustomer(provider, no.customer) : null;

  // Resolve each line to a local item (by external link, then SKU, else create).
  const lines: { itemId: string; qty: number; unitSalePrice: number; unitCostSnapshot: number; lineRevenue: number; lineCogs: number; lineProfit: number }[] = [];
  for (const l of no.lines) {
    let itemId: string | null = null;
    if (l.externalProductId) {
      const link = await findLink(provider, "item", l.externalProductId);
      if (link) itemId = link.entityId;
    }
    if (!itemId && l.sku) {
      const bySku = await prisma.item.findUnique({ where: { sku: l.sku } });
      if (bySku) itemId = bySku.id;
    }
    if (!itemId) {
      const created = await prisma.item.create({
        data: { name: l.title, sku: l.sku || autoSku(l.title), salePrice: l.unitPrice, quantity: 0, source: provider },
      });
      itemId = created.id;
      if (l.externalProductId) await linkEntity(provider, "item", itemId, l.externalProductId);
    }
    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    const { lineRevenue, lineCogs, lineProfit } = computeLine(l.qty, l.unitPrice, item.avgCost);
    lines.push({ itemId, qty: l.qty, unitSalePrice: l.unitPrice, unitCostSnapshot: item.avgCost, lineRevenue, lineCogs, lineProfit });
  }

  const revenue = lines.reduce((s, x) => s + x.lineRevenue, 0);
  const cogs = lines.reduce((s, x) => s + x.lineCogs, 0);
  const grossProfit = revenue - cogs;

  const sale = await prisma.sale.create({
    data: {
      contactId,
      date: no.date,
      status: no.paid ? "paid" : "unpaid",
      paymentMethod: provider,
      source: provider,
      notes: `Imported from ${provider} order ${no.number}`,
      revenue,
      cogs,
      grossProfit,
      lines: { create: lines },
    },
  });
  await linkEntity(provider, "sale", sale.id, no.externalId, no.url);
  await log(provider, "import", "sale", "created", "ok", { externalId: no.externalId, entityId: sale.id });
  return sale.id;
}

export interface ImportSummary {
  provider: string;
  products: number;
  customers: number;
  orders: number;
  errors: string[];
}

export async function runImport(provider: IntegrationProviderId): Promise<ImportSummary> {
  const conn = await prisma.integrationConnection.findUnique({ where: { provider } });
  if (!conn || conn.status !== "connected") {
    throw new IntegrationError(`${provider} is not connected.`, provider);
  }
  const client = buildClient(conn);
  const summary: ImportSummary = { provider, products: 0, customers: 0, orders: 0, errors: [] };

  // Refresh shop identity (and Shopify location) before syncing.
  try {
    const info = await client.testConnection();
    await prisma.integrationConnection.update({
      where: { provider },
      data: { shopName: info.shopName, externalShopId: info.externalShopId, locationId: info.locationId ?? conn.locationId, status: "connected" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "connection test failed";
    summary.errors.push(msg);
    await prisma.integrationConnection.update({ where: { provider }, data: { status: "error" } });
    await log(provider, "import", "item", "error", "error", { message: msg });
    return summary;
  }

  async function each<T>(items: T[], fn: (x: T) => Promise<unknown>, label: string) {
    for (const it of items) {
      try {
        await fn(it);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        summary.errors.push(`${label}: ${msg}`);
        await log(provider, "import", label, "error", "error", { message: msg });
      }
    }
  }

  try {
    const products = await client.importProducts();
    await each(products, async (p) => { await upsertProduct(provider, p); summary.products++; }, "item");
  } catch (e) {
    summary.errors.push(`products: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const customers = await client.importCustomers();
    await each(customers, async (c) => { await upsertCustomer(provider, c); summary.customers++; }, "contact");
  } catch (e) {
    summary.errors.push(`customers: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const orders = await client.importOrders();
    await each(orders, async (o) => { await upsertOrder(provider, o); summary.orders++; }, "sale");
  } catch (e) {
    summary.errors.push(`orders: ${e instanceof Error ? e.message : e}`);
  }

  await prisma.integrationConnection.update({ where: { provider }, data: { lastSyncedAt: new Date() } });
  return summary;
}

// --- EXPORT (two-way) ------------------------------------------------------

export async function pushProductToPlatform(provider: IntegrationProviderId, itemId: string) {
  const conn = await prisma.integrationConnection.findUnique({ where: { provider } });
  if (!conn || conn.status !== "connected") throw new IntegrationError(`${provider} is not connected.`, provider);
  if (!conn.twoWay) throw new IntegrationError(`Two-way sync is disabled for ${provider}.`, provider);

  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
  const client = buildClient(conn);
  // Existing link (if the item was already pushed/imported) drives create-vs-update.
  const existing = await prisma.externalLink.findFirst({ where: { provider, entityType: "item", entityId: itemId } });

  const res = await client.pushProduct({
    title: item.name,
    sku: item.sku,
    price: item.salePrice,
    quantity: item.quantity,
    description: item.notes ?? undefined,
    externalId: existing?.externalId ?? null,
  });
  await linkEntity(provider, "item", itemId, res.externalId, res.url);
  await log(provider, "export", "item", "pushed", "ok", { externalId: res.externalId, entityId: itemId });
  return res;
}

export async function pushInventoryToPlatform(provider: IntegrationProviderId, itemId: string) {
  const conn = await prisma.integrationConnection.findUnique({ where: { provider } });
  if (!conn || conn.status !== "connected") throw new IntegrationError(`${provider} is not connected.`, provider);
  if (!conn.twoWay) throw new IntegrationError(`Two-way sync is disabled for ${provider}.`, provider);

  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
  const existing = await prisma.externalLink.findFirst({ where: { provider, entityType: "item", entityId: itemId } });
  if (!existing) throw new IntegrationError(`Item is not linked on ${provider} yet — push the product first.`, provider);

  const client = buildClient(conn);
  await client.pushInventory({ externalId: existing.externalId, sku: item.sku, quantity: item.quantity });
  await log(provider, "export", "inventory", "pushed", "ok", { externalId: existing.externalId, entityId: itemId });
}
