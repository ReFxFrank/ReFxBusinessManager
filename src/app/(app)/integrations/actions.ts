"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { isAuthenticated } from "@/lib/auth";
import { ShopifyClient, normalizeShopDomain } from "@/lib/integrations/shopify";
import { EtsyClient } from "@/lib/integrations/etsy";
import { runImport, pushProductToPlatform, pushInventoryToPlatform } from "@/lib/integrations/sync";
import type { ConnectionContext, IntegrationProviderId } from "@/lib/integrations/types";

export type IntegrationResult = { ok: boolean; error?: string; message?: string };

/** Mutating actions verify the session HMAC (middleware only checks presence). */
async function requireAuth() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

export async function connectShopify(_prev: IntegrationResult, formData: FormData): Promise<IntegrationResult> {
  await requireAuth();
  const token = String(formData.get("accessToken") ?? "").trim();
  let domain: string;
  try {
    domain = normalizeShopDomain(String(formData.get("shopDomain") ?? ""));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid shop domain." };
  }
  if (!token) return { ok: false, error: "Admin API access token is required." };

  const ctx: ConnectionContext = { provider: "shopify", shopDomain: domain, externalShopId: null, accessToken: token, locationId: null };
  try {
    const info = await new ShopifyClient(ctx).testConnection();
    await prisma.integrationConnection.upsert({
      where: { provider: "shopify" },
      update: { shopDomain: domain, accessToken: token, shopName: info.shopName, externalShopId: info.externalShopId, locationId: info.locationId, status: "connected" },
      create: { provider: "shopify", shopDomain: domain, accessToken: token, shopName: info.shopName, externalShopId: info.externalShopId, locationId: info.locationId, status: "connected" },
    });
    revalidatePath("/integrations");
    return { ok: true, message: `Connected to ${info.shopName}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not connect to Shopify." };
  }
}

export async function connectEtsy(_prev: IntegrationResult, formData: FormData): Promise<IntegrationResult> {
  await requireAuth();
  if (!config.integrations.etsy.configured) return { ok: false, error: "Set ETSY_KEYSTRING in the environment first." };
  const shopId = String(formData.get("shopId") ?? "").trim();
  const token = String(formData.get("accessToken") ?? "").trim();
  if (!/^[0-9]+$/.test(shopId)) return { ok: false, error: "Etsy shop id must be numeric." };
  if (!token) return { ok: false, error: "Etsy OAuth access token is required." };

  const ctx: ConnectionContext = { provider: "etsy", shopDomain: null, externalShopId: shopId, accessToken: token, locationId: null };
  try {
    const info = await new EtsyClient(ctx).testConnection();
    await prisma.integrationConnection.upsert({
      where: { provider: "etsy" },
      update: { externalShopId: info.externalShopId, accessToken: token, shopName: info.shopName, status: "connected" },
      create: { provider: "etsy", externalShopId: info.externalShopId, accessToken: token, shopName: info.shopName, status: "connected" },
    });
    revalidatePath("/integrations");
    return { ok: true, message: `Connected to ${info.shopName}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not connect to Etsy." };
  }
}

export async function setTwoWay(provider: IntegrationProviderId, enabled: boolean): Promise<void> {
  await requireAuth();
  await prisma.integrationConnection.update({ where: { provider }, data: { twoWay: enabled } });
  revalidatePath("/integrations");
}

export async function disconnect(provider: IntegrationProviderId): Promise<void> {
  await requireAuth();
  await prisma.integrationConnection.deleteMany({ where: { provider } });
  revalidatePath("/integrations");
}

export async function syncNow(provider: IntegrationProviderId): Promise<IntegrationResult> {
  await requireAuth();
  try {
    const s = await runImport(provider);
    revalidatePath("/integrations");
    revalidatePath("/");
    revalidatePath("/inventory");
    revalidatePath("/finances");
    const msg = `Imported ${s.products} products, ${s.orders} orders, ${s.customers} customers.${s.errors.length ? ` ${s.errors.length} issue(s).` : ""}`;
    return { ok: s.errors.length === 0, message: msg, error: s.errors[0] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  }
}

export async function pushItem(provider: IntegrationProviderId, itemId: string): Promise<IntegrationResult> {
  await requireAuth();
  try {
    await pushProductToPlatform(provider, itemId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Push failed." };
  }
  // Product pushed; surface (don't swallow) any inventory-sync failure.
  try {
    await pushInventoryToPlatform(provider, itemId);
  } catch (e) {
    revalidatePath("/integrations");
    return { ok: true, message: `Product pushed to ${provider}, but inventory sync failed: ${e instanceof Error ? e.message : "error"}` };
  }
  revalidatePath("/integrations");
  return { ok: true, message: `Pushed to ${provider}.` };
}
