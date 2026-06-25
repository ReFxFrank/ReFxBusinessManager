import { facebookPublisher } from "./facebook";
import { instagramPublisher } from "./instagram";
import type { SocialProvider, SocialPublisher } from "./types";

const publishers: Record<SocialProvider, SocialPublisher> = {
  facebook: facebookPublisher,
  instagram: instagramPublisher,
};

export function getPublisher(provider: SocialProvider): SocialPublisher {
  return publishers[provider];
}

export * from "./types";
export * from "./meta";
