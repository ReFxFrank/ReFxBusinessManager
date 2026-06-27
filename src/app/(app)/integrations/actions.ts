"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { ShopifyClient } from "@/lib/integrations/shopify";
import { EtsyClient } from "@/lib/integrations/etsy";
import { runImport, pushProductToPlatform, pushInventoryToPlatform } from "@/lib/integrations/sync";
import type { ConnectionContext, IntegrationProviderId } from "@/lib/integrations/types";

export type IntegrationResult = { ok: boolean; error?: string; message?: string };

export async function connectShopify(_prev: IntegrationResult, formData: FormData): Promise<IntegrationResult> {
  const domain = String(formData.get("shopDomain") ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = String(formData.get("accessToken") ?? "").trim();
  if (!domain || !token) return { ok: false, error: "Shop domain and Admin API access token are required." };

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
  if (!config.integrations.etsy.configured) return { ok: false, error: "Set ETSY_KEYSTRING in the environment first." };
  const shopId = String(formData.get("shopId") ?? "").trim();
  const token = String(formData.get("accessToken") ?? "").trim();
  if (!shopId || !token) return { ok: false, error: "Etsy shop id and OAuth access token are required." };

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
  await prisma.integrationConnection.update({ where: { provider }, data: { twoWay: enabled } });
  revalidatePath("/integrations");
}

export async function disconnect(provider: IntegrationProviderId): Promise<void> {
  await prisma.integrationConnection.deleteMany({ where: { provider } });
  revalidatePath("/integrations");
}

export async function syncNow(provider: IntegrationProviderId): Promise<IntegrationResult> {
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
  try {
    await pushProductToPlatform(provider, itemId);
    await pushInventoryToPlatform(provider, itemId).catch(() => {});
    revalidatePath("/integrations");
    return { ok: true, message: `Pushed to ${provider}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Push failed." };
  }
}
