/**
 * Shopify Admin REST API client (version pinned via SHOPIFY_API_VERSION,
 * default 2026-01). Auth via the X-Shopify-Access-Token header — a custom app's
 * Admin API access token (shpat_…) is all that's needed.
 *
 * Security: the shop domain is strictly validated to *.myshopify.com so the
 * access token can never be sent to an arbitrary/internal host (no SSRF).
 *
 * Verify endpoints against the current docs: https://shopify.dev/docs/api/admin-rest
 */

import { config } from "../config";
import {
  IntegrationError,
  type ConnectionContext,
  type IntegrationProvider,
  type NormalizedCustomer,
  type NormalizedOrder,
  type NormalizedProduct,
  type PushResult,
} from "./types";

const toCents = (v: string | number | null | undefined) =>
  v == null ? 0 : Math.round(Number(v) * 100);

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** Validate + normalize a Shopify shop domain. Throws on anything not *.myshopify.com. */
export function normalizeShopDomain(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!SHOP_DOMAIN_RE.test(cleaned)) {
    throw new IntegrationError(
      "Invalid Shopify domain — expected something like your-shop.myshopify.com (no port or path).",
      "shopify",
    );
  }
  return cleaned;
}

export class ShopifyClient implements IntegrationProvider {
  id = "shopify" as const;
  private domain: string;
  constructor(private ctx: ConnectionContext) {
    if (!ctx.shopDomain || !ctx.accessToken) {
      throw new IntegrationError("Shopify is not connected (missing shop domain or token).", "shopify");
    }
    // Re-validate here so the token is never sent to a non-Shopify host even if
    // a bad domain somehow reached the DB.
    this.domain = normalizeShopDomain(ctx.shopDomain);
  }

  private base() {
    return `https://${this.domain}/admin/api/${config.integrations.shopify.apiVersion}`;
  }

  private async raw(path: string, init?: RequestInit): Promise<{ json: any; link: string | null }> {
    const res = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: {
        "X-Shopify-Access-Token": this.ctx.accessToken!,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new IntegrationError(
        `Shopify ${res.status}: ${json.errors ? JSON.stringify(json.errors) : res.statusText}`,
        "shopify",
      );
    }
    return { json, link: res.headers.get("link") };
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    return (await this.raw(path, init)).json as T;
  }

  /** Follow Shopify's cursor (Link header rel="next") pagination to completion. */
  private async getAll<T>(resource: string, key: string, firstQuery: string): Promise<T[]> {
    const out: T[] = [];
    let path: string | null = `/${resource}.json?limit=250${firstQuery ? `&${firstQuery}` : ""}`;
    let guard = 0;
    while (path && guard++ < 100) {
      const { json, link } = await this.raw(path);
      out.push(...((json[key] as T[]) ?? []));
      const next = parseNextPageInfo(link);
      // page_info cannot be combined with other filters on subsequent pages.
      path = next ? `/${resource}.json?limit=250&page_info=${encodeURIComponent(next)}` : null;
    }
    return out;
  }

  async testConnection() {
    const shop = await this.req<{ shop: { id: number; name: string } }>("/shop.json");
    let locationId = this.ctx.locationId ?? undefined;
    if (!locationId) {
      const locs = await this.req<{ locations: { id: number }[] }>("/locations.json");
      locationId = locs.locations?.[0]?.id?.toString();
    }
    return { shopName: shop.shop.name, externalShopId: shop.shop.id.toString(), locationId };
  }

  async importProducts(): Promise<NormalizedProduct[]> {
    const products = await this.getAll<ShopifyProduct>("products", "products", "");
    return products.map((p) => {
      const v = p.variants?.[0];
      return {
        externalId: p.id.toString(),
        title: p.title,
        sku: v?.sku || null,
        price: toCents(v?.price),
        quantity: v?.inventory_quantity ?? 0,
        category: p.product_type || null,
        imageUrl: p.image?.src ?? null,
        url: `https://${this.domain}/products/${p.handle}`,
        raw: p,
      };
    });
  }

  async importCustomers(): Promise<NormalizedCustomer[]> {
    const customers = await this.getAll<ShopifyCustomer>("customers", "customers", "");
    return customers.map((c) => ({
      externalId: c.id.toString(),
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Shopify customer",
      email: c.email ?? null,
      phone: c.phone ?? null,
      raw: c,
    }));
  }

  async importOrders(sinceDays = 90): Promise<NormalizedOrder[]> {
    const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
    const orders = await this.getAll<ShopifyOrder>(
      "orders",
      "orders",
      `status=any&created_at_min=${encodeURIComponent(since)}`,
    );
    return orders.map((o) => ({
      externalId: o.id.toString(),
      number: o.name,
      date: new Date(o.created_at),
      paid: o.financial_status === "paid",
      total: toCents(o.total_price),
      customer: o.customer
        ? {
            externalId: o.customer.id.toString(),
            name: [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || "Shopify customer",
            email: o.customer.email ?? null,
            phone: o.customer.phone ?? null,
          }
        : null,
      lines: (o.line_items ?? []).map((li) => ({
        externalProductId: li.product_id?.toString() ?? null,
        sku: li.sku || null,
        title: li.title,
        qty: li.quantity,
        unitPrice: toCents(li.price),
      })),
      url: `https://${this.domain}/admin/orders/${o.id}`,
      raw: o,
    }));
  }

  async pushProduct(input: {
    title: string;
    sku: string | null;
    price: number;
    quantity: number;
    description?: string;
    externalId?: string | null;
  }): Promise<PushResult> {
    const variant: Record<string, unknown> = {
      price: (input.price / 100).toFixed(2),
      sku: input.sku ?? undefined,
      inventory_management: "shopify",
    };

    if (input.externalId) {
      // Update: target the EXISTING variant by id so we don't create a duplicate.
      const current = await this.req<{ product: ShopifyProduct }>(`/products/${input.externalId}.json`);
      const existingVariantId = current.product.variants?.[0]?.id;
      if (existingVariantId) variant.id = existingVariantId;
      const res = await this.req<{ product: ShopifyProduct }>(`/products/${input.externalId}.json`, {
        method: "PUT",
        body: JSON.stringify({ product: { id: Number(input.externalId), title: input.title, body_html: input.description ?? "", variants: [variant] } }),
      });
      return { externalId: res.product.id.toString(), url: `https://${this.domain}/products/${res.product.handle}` };
    }

    const res = await this.req<{ product: ShopifyProduct }>("/products.json", {
      method: "POST",
      body: JSON.stringify({ product: { title: input.title, body_html: input.description ?? "", variants: [variant] } }),
    });
    return { externalId: res.product.id.toString(), url: `https://${this.domain}/products/${res.product.handle}` };
  }

  async pushInventory(input: { externalId: string; sku: string | null; quantity: number }): Promise<void> {
    const prod = await this.req<{ product: ShopifyProduct }>(`/products/${input.externalId}.json`);
    const inventoryItemId = prod.product.variants?.[0]?.inventory_item_id;
    if (!inventoryItemId) throw new IntegrationError("No inventory item for product.", "shopify");
    const ctx = await this.testConnection();
    const locationId = this.ctx.locationId ?? ctx.locationId;
    if (!locationId) throw new IntegrationError("No Shopify location to set inventory.", "shopify");
    // Ensure the inventory item is connected to the location (ignore "already connected").
    try {
      await this.req("/inventory_levels/connect.json", {
        method: "POST",
        body: JSON.stringify({ location_id: Number(locationId), inventory_item_id: inventoryItemId }),
      });
    } catch {
      // already connected — fine
    }
    await this.req("/inventory_levels/set.json", {
      method: "POST",
      body: JSON.stringify({
        location_id: Number(locationId),
        inventory_item_id: inventoryItemId,
        available: Math.round(input.quantity),
      }),
    });
  }
}

/** Parse Shopify's Link header for the rel="next" page_info cursor. */
function parseNextPageInfo(link: string | null): string | null {
  if (!link) return null;
  const m = link.match(/<([^>]+)>;\s*rel="next"/);
  if (!m) return null;
  try {
    return new URL(m[1]).searchParams.get("page_info");
  } catch {
    return null;
  }
}

// --- Shopify payload shapes (partial) --------------------------------------
interface ShopifyVariant {
  id: number;
  price: string;
  sku: string | null;
  inventory_quantity: number;
  inventory_item_id: number;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string | null;
  image?: { src: string } | null;
  variants: ShopifyVariant[];
}
interface ShopifyCustomer {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}
interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  financial_status: string;
  total_price: string;
  customer: ShopifyCustomer | null;
  line_items: { product_id: number | null; sku: string | null; title: string; quantity: number; price: string }[];
}
