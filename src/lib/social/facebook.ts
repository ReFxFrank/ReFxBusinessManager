import { graphPost } from "./meta";
import type { PublishInput, PublishResult, SocialPublisher } from "./types";

/**
 * Facebook Page publisher — photo and video posts via the Graph API.
 * Publishing targets a Page the user manages (personal-profile publishing is
 * not available via the API).
 */
export const facebookPublisher: SocialPublisher = {
  provider: "facebook",
  async publish(input: PublishInput): Promise<PublishResult> {
    if (input.mediaType === "image") {
      const res = await graphPost<{ id: string; post_id?: string }>(`${input.targetId}/photos`, {
        url: input.mediaUrl,
        caption: input.caption,
        access_token: input.accessToken,
      });
      const postId = res.post_id ?? res.id;
      return { externalId: postId, permalink: `https://www.facebook.com/${postId}` };
    }
    // video
    const res = await graphPost<{ id: string }>(`${input.targetId}/videos`, {
      file_url: input.mediaUrl,
      description: input.caption,
      access_token: input.accessToken,
    });
    return { externalId: res.id, permalink: `https://www.facebook.com/${res.id}` };
  },
};
