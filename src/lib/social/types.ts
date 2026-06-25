/** Shared types for the pluggable SocialPublisher interface. */

export type SocialProvider = "facebook" | "instagram";

export interface PublishInput {
  /** Public, internet-reachable media URL (image_url/video_url for IG). */
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  /** Target id — Page id for FB, IG user id for Instagram. */
  targetId: string;
  /** Page access token. */
  accessToken: string;
}

export interface PublishResult {
  externalId: string;
  permalink: string | null;
}

export interface SocialPublisher {
  provider: SocialProvider;
  publish(input: PublishInput): Promise<PublishResult>;
}

export class SocialError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SocialError";
  }
}
