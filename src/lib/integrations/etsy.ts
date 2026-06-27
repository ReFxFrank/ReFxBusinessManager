/**
 * Etsy Open API v3 client.
 *   base: https://openapi.etsy.com/v3/application
 *   headers: x-api-key: <keystring>  +  Authorization: Bearer <oauth token>
 *
 * Etsy requires OAuth2 (PKCE) for shop data, and PRODUCTION access requires
 * Etsy app review (dev/personal access works immediately). Listing creation
 * needs a shipping profile + taxonomy id, so pushProduct is best-effort and
 * surfaces Etsy's validation errors clearly.
 *
 * Verify against: https://developers.etsy.com/documentation/reference
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

const BASE = "https://openapi.etsy.com/v3/application";

const priceToCents = (p?: { amount: number; divisor: number } | null) =>
  p && p.divisor ? Math.round((p.amount / p.divisor) * 100) : 0;

export class EtsyClient implements IntegrationProvider {
  id = "etsy" as const;
  constructor(private ctx: ConnectionContext) {
    if (!ctx.accessToken || !ctx.externalShopId) {
      throw new IntegrationError("Etsy is not connected (missing token or shop id).", "etsy");
    }
    if (!config.integrations.etsy.keystring) {
      throw new IntegrationError("ETSY_KEYSTRING is not set in the environment.", "etsy");
    }
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "x-api-key": config.integrations.etsy.keystring,
        Authorization: `Bearer ${this.ctx.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new IntegrationError(`Etsy ${res.status}: ${json.error ?? res.statusText}`, "etsy");
    }
    return json as T;
  }

  private shopId() {
    return this.ctx.externalShopId!;
  }

  async testConnection() {
    const shop = await this.req<{ shop_id: number; shop_name: string }>(`/shops/${this.shopId()}`);
    return { shopName: shop.shop_name, externalShopId: shop.shop_id.toString() };
  }

  async importProducts(): Promise<NormalizedProduct[]> {
    const data = await this.req<{ results: EtsyListing[] }>(
      `/shops/${this.shopId()}/listings/active?limit=100&includes=Images`,
    );
    return (data.results ?? []).map((l) => ({
      externalId: l.listing_id.toString(),
      title: l.title,
      sku: l.skus?.[0] ?? null,
      price: priceToCents(l.price),
      quantity: l.quantity ?? 0,
      category: l.taxonomy_id ? `Etsy ${l.taxonomy_id}` : null,
      imageUrl: l.images?.[0]?.url_570xN ?? null,
      url: l.url ?? null,
      raw: l,
    }));
  }

  async importCustomers(): Promise<NormalizedCustomer[]> {
    // Etsy exposes buyers only via receipts; we surface them from importOrders.
    return [];
  }

  async importOrders(sinceDays = 90): Promise<NormalizedOrder[]> {
    const minCreated = Math.floor((Date.now() - sinceDays * 864e5) / 1000);
    const data = await this.req<{ results: EtsyReceipt[] }>(
      `/shops/${this.shopId()}/receipts?limit=100&min_created=${minCreated}&includes=Transactions`,
    );
    return (data.results ?? []).map((r) => {
      const name = [r.name, r.first_line].filter(Boolean).join(" ") || r.buyer_email || "Etsy buyer";
      return {
        externalId: r.receipt_id.toString(),
        number: `#${r.receipt_id}`,
        date: new Date((r.created_timestamp ?? 0) * 1000),
        paid: Boolean(r.is_paid),
        total: priceToCents(r.grandtotal),
        customer: {
          externalId: r.buyer_user_id ? r.buyer_user_id.toString() : `etsy-${r.receipt_id}`,
          name,
          email: r.buyer_email ?? null,
          phone: null,
        },
        lines: (r.transactions ?? []).map((t) => ({
          externalProductId: t.listing_id?.toString() ?? null,
          sku: t.sku ?? null,
          title: t.title,
          qty: t.quantity,
          unitPrice: priceToCents(t.price),
        })),
        url: `https://www.etsy.com/your/orders/sold/completed?order_id=${r.receipt_id}`,
        raw: r,
      };
    });
  }

  async pushProduct(input: {
    title: string;
    sku: string | null;
    price: number;
    quantity: number;
    description?: string;
    externalId?: string | null;
  }): Promise<PushResult> {
    // Etsy listing creation needs who_made / when_made / taxonomy_id and a
    // shipping_profile_id (for physical goods). We send sensible defaults; Etsy
    // returns a clear validation error if a shipping profile/taxonomy is required.
    const body = {
      quantity: Math.max(1, Math.round(input.quantity)),
      title: input.title,
      description: input.description ?? input.title,
      price: Number((input.price / 100).toFixed(2)),
      who_made: "i_did",
      when_made: "made_to_order",
      taxonomy_id: 1, // caller should override via Etsy; 1 is a placeholder
      ...(input.sku ? { skus: [input.sku] } : {}),
    };
    const res = await this.req<{ listing_id: number; url?: string }>(
      `/shops/${this.shopId()}/listings`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return { externalId: res.listing_id.toString(), url: res.url ?? null };
  }

  async pushInventory(input: { externalId: string; sku: string | null; quantity: number }): Promise<void> {
    // Minimal inventory update: set the quantity on the single default offering.
    const current = await this.req<{ products: EtsyInventoryProduct[] }>(
      `/listings/${input.externalId}/inventory`,
    );
    const products = (current.products ?? []).map((p) => ({
      sku: p.sku ?? input.sku ?? "",
      property_values: p.property_values ?? [],
      offerings: (p.offerings ?? []).map((o) => ({
        price: o.price?.amount && o.price?.divisor ? o.price.amount / o.price.divisor : 0,
        quantity: Math.round(input.quantity),
        is_enabled: true,
      })),
    }));
    await this.req(`/listings/${input.externalId}/inventory`, {
      method: "PUT",
      body: JSON.stringify({ products }),
    });
  }
}

// --- Etsy payload shapes (partial) -----------------------------------------
interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code?: string;
}
interface EtsyListing {
  listing_id: number;
  title: string;
  quantity: number;
  price?: EtsyMoney;
  skus?: string[];
  taxonomy_id?: number;
  url?: string;
  images?: { url_570xN: string }[];
}
interface EtsyReceipt {
  receipt_id: number;
  name?: string;
  first_line?: string;
  buyer_email?: string;
  buyer_user_id?: number;
  created_timestamp?: number;
  is_paid?: boolean;
  grandtotal?: EtsyMoney;
  transactions?: { listing_id: number | null; sku: string | null; title: string; quantity: number; price?: EtsyMoney }[];
}
interface EtsyInventoryProduct {
  sku?: string;
  property_values?: unknown[];
  offerings?: { price?: EtsyMoney; quantity?: number }[];
}
