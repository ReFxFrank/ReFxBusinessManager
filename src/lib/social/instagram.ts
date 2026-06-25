import { graphGet, graphPost } from "./meta";
import type { PublishInput, PublishResult, SocialPublisher } from "./types";
import { SocialError } from "./types";

/**
 * Instagram publisher — container → (poll status for video) → publish flow.
 * Instagram fetches the media from a PUBLIC url (image_url/video_url), so the
 * storage layer must serve media at an internet-reachable URL.
 *
 * Targets an IG Business/Creator account linked to a managed Page (not personal
 * IG accounts).
 */

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 60; // ~4 minutes; docs suggest once/min for up to 5 min

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const instagramPublisher: SocialPublisher = {
  provider: "instagram",
  async publish(input: PublishInput): Promise<PublishResult> {
    // 1) Create container
    const containerParams: Record<string, string> =
      input.mediaType === "image"
        ? { image_url: input.mediaUrl, caption: input.caption, access_token: input.accessToken }
        : {
            video_url: input.mediaUrl,
            media_type: "REELS",
            caption: input.caption,
            access_token: input.accessToken,
          };

    const container = await graphPost<{ id: string }>(`${input.targetId}/media`, containerParams);

    // 2) For video, poll container status until FINISHED
    if (input.mediaType === "video") {
      let ready = false;
      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);
        const status = await graphGet<{ status_code: string }>(container.id, {
          fields: "status_code",
          access_token: input.accessToken,
        });
        if (status.status_code === "FINISHED") {
          ready = true;
          break;
        }
        if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
          throw new SocialError(`Instagram media processing ${status.status_code}.`);
        }
      }
      if (!ready) throw new SocialError("Instagram media did not finish processing in time.");
    }

    // 3) Publish the container
    const published = await graphPost<{ id: string }>(`${input.targetId}/media_publish`, {
      creation_id: container.id,
      access_token: input.accessToken,
    });

    // 4) Best-effort permalink lookup
    let permalink: string | null = null;
    try {
      const info = await graphGet<{ permalink: string }>(published.id, {
        fields: "permalink",
        access_token: input.accessToken,
      });
      permalink = info.permalink ?? null;
    } catch {
      // permalink is optional
    }

    return { externalId: published.id, permalink };
  },
};
