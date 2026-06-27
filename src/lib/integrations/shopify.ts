/**
 * Shopify Admin REST API client (version pinned via SHOPIFY_API_VERSION,
 * default 2026-01). Auth via the X-Shopify-Access-Token header — a custom app's
 * Admin API access token (shpat_…) is all that's needed.
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

export class ShopifyClient implements IntegrationProvider {
  id = "shopify" as const;
  constructor(private ctx: ConnectionContext) {
    if (!ctx.shopDomain || !ctx.accessToken) {
      throw new IntegrationError("Shopify is not connected (missing shop domain or token).", "shopify");
    }
  }

  private base() {
    return `https://${this.ctx.shopDomain}/admin/api/${config.integrations.shopify.apiVersion}`;
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
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
    return json as T;
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
    const data = await this.req<{ products: ShopifyProduct[] }>("/products.json?limit=250");
    return data.products.map((p) => {
      const v = p.variants?.[0];
      return {
        externalId: p.id.toString(),
        title: p.title,
        sku: v?.sku || null,
        price: toCents(v?.price),
        quantity: v?.inventory_quantity ?? 0,
        category: p.product_type || null,
        imageUrl: p.image?.src ?? null,
        url: this.ctx.shopDomain ? `https://${this.ctx.shopDomain}/products/${p.handle}` : null,
        raw: p,
      };
    });
  }

  async importCustomers(): Promise<NormalizedCustomer[]> {
    const data = await this.req<{ customers: ShopifyCustomer[] }>("/customers.json?limit=250");
    return data.customers.map((c) => ({
      externalId: c.id.toString(),
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Shopify customer",
      email: c.email ?? null,
      phone: c.phone ?? null,
      raw: c,
    }));
  }

  async importOrders(sinceDays = 90): Promise<NormalizedOrder[]> {
    const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
    const data = await this.req<{ orders: ShopifyOrder[] }>(
      `/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(since)}`,
    );
    return data.orders.map((o) => ({
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
      url: this.ctx.shopDomain ? `https://${this.ctx.shopDomain}/admin/orders/${o.id}` : null,
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
    const body = {
      product: {
        title: input.title,
        body_html: input.description ?? "",
        variants: [
          {
            price: (input.price / 100).toFixed(2),
            sku: input.sku ?? undefined,
            inventory_management: "shopify",
          },
        ],
      },
    };
    const res = input.externalId
      ? await this.req<{ product: ShopifyProduct }>(`/products/${input.externalId}.json`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      : await this.req<{ product: ShopifyProduct }>("/products.json", {
          method: "POST",
          body: JSON.stringify(body),
        });
    return {
      externalId: res.product.id.toString(),
      url: this.ctx.shopDomain ? `https://${this.ctx.shopDomain}/products/${res.product.handle}` : null,
    };
  }

  async pushInventory(input: { externalId: string; sku: string | null; quantity: number }): Promise<void> {
    // Resolve the variant's inventory_item_id, then set the level at our location.
    const prod = await this.req<{ product: ShopifyProduct }>(`/products/${input.externalId}.json`);
    const inventoryItemId = prod.product.variants?.[0]?.inventory_item_id;
    if (!inventoryItemId) throw new IntegrationError("No inventory item for product.", "shopify");
    const ctx = await this.testConnection();
    const locationId = this.ctx.locationId ?? ctx.locationId;
    if (!locationId) throw new IntegrationError("No Shopify location to set inventory.", "shopify");
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
