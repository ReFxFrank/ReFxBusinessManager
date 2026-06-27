/**
 * Pluggable platform-integration interface (Shopify / Etsy).
 *
 * Each provider normalizes its API payloads into the DTOs below, so the sync
 * orchestrator (sync.ts) is platform-agnostic. Money is always integer cents.
 *
 * The whole feature is OPTIONAL + gated by configuration. Nothing here runs
 * unless the user connects a platform with valid credentials.
 */

export type IntegrationProviderId = "shopify" | "etsy";

export interface NormalizedProduct {
  externalId: string;
  title: string;
  sku: string | null;
  price: number; // cents
  quantity: number;
  category: string | null;
  imageUrl: string | null;
  url: string | null;
  raw?: unknown;
}

export interface NormalizedCustomer {
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  raw?: unknown;
}

export interface NormalizedOrderLine {
  externalProductId: string | null;
  sku: string | null;
  title: string;
  qty: number;
  unitPrice: number; // cents
}

export interface NormalizedOrder {
  externalId: string;
  number: string;
  date: Date;
  paid: boolean;
  total: number; // cents
  customer: NormalizedCustomer | null;
  lines: NormalizedOrderLine[];
  url: string | null;
  raw?: unknown;
}

/** Connection record fields a provider client needs (subset of IntegrationConnection). */
export interface ConnectionContext {
  provider: IntegrationProviderId;
  shopDomain: string | null;
  externalShopId: string | null;
  accessToken: string | null;
  locationId: string | null;
}

export interface PushResult {
  externalId: string;
  url: string | null;
}

export interface IntegrationProvider {
  id: IntegrationProviderId;
  /** Verify the credentials work; returns shop display name + external shop id. */
  testConnection(): Promise<{ shopName: string; externalShopId: string; locationId?: string }>;
  importProducts(): Promise<NormalizedProduct[]>;
  importCustomers(): Promise<NormalizedCustomer[]>;
  importOrders(sinceDays?: number): Promise<NormalizedOrder[]>;
  /** Two-way: create/update the product on the platform. */
  pushProduct(input: { title: string; sku: string | null; price: number; quantity: number; description?: string; externalId?: string | null }): Promise<PushResult>;
  /** Two-way: set the available stock for an already-linked product. */
  pushInventory(input: { externalId: string; sku: string | null; quantity: number }): Promise<void>;
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}
