import { config } from "../config";
import type { IntegrationProviderId } from "./types";

export const PROVIDERS: { id: IntegrationProviderId; name: string }[] = [
  { id: "shopify", name: "Shopify" },
  { id: "etsy", name: "Etsy" },
];

/** A provider is "available" if the app has the minimum env config to use it. */
export function providerAvailable(id: IntegrationProviderId): boolean {
  // Shopify custom apps need no app-level env (just a shop domain + token entered
  // by the user), so it's always available. Etsy needs a keystring (x-api-key).
  if (id === "etsy") return config.integrations.etsy.configured;
  return true;
}

export * from "./types";
export * from "./sync";
