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
const PAGE = 100;

const priceToCents = (p?: { amount: number; divisor: number } | null) =>
  p && p.divisor ? Math.round((p.amount / p.divisor) * 100) : 0;

export class EtsyClient implements IntegrationProvider {
  id = "etsy" as const;
  constructor(private ctx: ConnectionContext) {
    if (!ctx.accessToken || !ctx.externalShopId) {
      throw new IntegrationError("Etsy is not connected (missing token or shop id).", "etsy");
    }
    if (!/^[0-9]+$/.test(ctx.externalShopId)) {
      throw new IntegrationError("Invalid Etsy shop id (must be numeric).", "etsy");
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

  /** Page through an Etsy list endpoint via the offset param until exhausted. */
  private async getAll<T>(buildPath: (offset: number) => string): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    let guard = 0;
    // Etsy returns { count, results }. Stop when a short page comes back.
    // eslint-disable-next-line no-constant-condition
    while (guard++ < 200) {
      const data = await this.req<{ count: number; results: T[] }>(buildPath(offset));
      const results = data.results ?? [];
      out.push(...results);
      if (results.length < PAGE || out.length >= (data.count ?? out.length)) break;
      offset += PAGE;
    }
    return out;
  }

  private shopId() {
    return this.ctx.externalShopId!;
  }

  async testConnection() {
    const shop = await this.req<{ shop_id: number; shop_name: string }>(`/shops/${this.shopId()}`);
    return { shopName: shop.shop_name, externalShopId: shop.shop_id.toString() };
  }

  async importProducts(): Promise<NormalizedProduct[]> {
    const listings = await this.getAll<EtsyListing>(
      (o) => `/shops/${this.shopId()}/listings/active?limit=${PAGE}&offset=${o}&includes=Images,Inventory`,
    );
    return listings.map((l) => ({
      externalId: l.listing_id.toString(),
      title: l.title,
      // SKUs live on inventory offerings, not the top-level listing.
      sku: l.inventory?.products?.[0]?.sku ?? null,
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
    const receipts = await this.getAll<EtsyReceipt>(
      (o) => `/shops/${this.shopId()}/receipts?limit=${PAGE}&offset=${o}&min_created=${minCreated}&includes=Transactions`,
    );
    return receipts.map((r) => ({
      externalId: r.receipt_id.toString(),
      number: `#${r.receipt_id}`,
      date: new Date((r.created_timestamp ?? 0) * 1000),
      paid: Boolean(r.is_paid),
      total: priceToCents(r.grandtotal),
      customer: {
        externalId: r.buyer_user_id ? r.buyer_user_id.toString() : `etsy-${r.receipt_id}`,
        // `name` is the buyer/recipient name; `first_line` is a street address — never use it as a name.
        name: r.name || r.buyer_email || "Etsy buyer",
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
    // Etsy listing creation needs who_made / when_made / taxonomy_id and a
    // shipping_profile_id (for physical goods). We send sensible defaults; Etsy
    // returns a clear validation error if a shipping profile/taxonomy is required.
    // NOTE: SKU is NOT accepted by createDraftListing — it is set afterwards via
    // PUT /listings/{id}/inventory (see pushInventory), so we don't send it here.
    const body = {
      quantity: Math.max(1, Math.round(input.quantity)),
      title: input.title,
      description: input.description ?? input.title,
      price: Number((input.price / 100).toFixed(2)),
      who_made: "i_did",
      when_made: "made_to_order",
      taxonomy_id: 1, // placeholder — override with your shop's real taxonomy id
    };
    const res = await this.req<{ listing_id: number; url?: string }>(
      `/shops/${this.shopId()}/listings`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return { externalId: res.listing_id.toString(), url: res.url ?? null };
  }

  async pushInventory(input: { externalId: string; sku: string | null; quantity: number }): Promise<void> {
    const current = await this.req<{ products: EtsyInventoryProduct[] }>(
      `/listings/${input.externalId}/inventory`,
    );
    const products = (current.products ?? []).map((p) => ({
      sku: input.sku ?? p.sku ?? "",
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
interface EtsyInventoryProduct {
  sku?: string;
  property_values?: unknown[];
  offerings?: { price?: EtsyMoney; quantity?: number }[];
}
interface EtsyListing {
  listing_id: number;
  title: string;
  quantity: number;
  price?: EtsyMoney;
  taxonomy_id?: number;
  url?: string;
  images?: { url_570xN: string }[];
  inventory?: { products?: EtsyInventoryProduct[] };
}
interface EtsyReceipt {
  receipt_id: number;
  name?: string; // buyer/recipient name
  first_line?: string; // shipping address street — NOT a name
  buyer_email?: string;
  buyer_user_id?: number;
  created_timestamp?: number;
  is_paid?: boolean;
  grandtotal?: EtsyMoney;
  transactions?: { listing_id: number | null; sku: string | null; title: string; quantity: number; price?: EtsyMoney }[];
}
