"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { config, publicUrlIsReachable } from "@/lib/config";
import { storage } from "@/lib/storage";
import { getPublisher, SocialError, type SocialProvider } from "@/lib/social";

export type PublishActionResult =
  | { ok: true; permalink: string | null }
  | { ok: false; error: string };

/** Remove a stored connection for a provider. */
export async function disconnect(provider: string): Promise<void> {
  await prisma.socialConnection.deleteMany({ where: { provider } });
  revalidatePath("/settings/connections");
}

/**
 * Publish a single Media item to a connected provider. Always records a
 * SocialPost row (published or failed) and never throws — errors are returned
 * to the caller so the UI can surface them per-provider.
 */
export async function publishMedia(
  mediaId: string,
  provider: SocialProvider,
  caption: string,
): Promise<PublishActionResult> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    return { ok: false, error: "Media not found." };
  }

  const connection = await prisma.socialConnection.findUnique({ where: { provider } });

  if (!config.meta.configured || !connection || connection.status !== "connected") {
    await prisma.socialPost.create({
      data: {
        mediaId: media.id,
        provider,
        target: "",
        caption,
        status: "failed",
        error: "not connected",
      },
    });
    revalidatePath("/settings/connections");
    return { ok: false, error: "not connected" };
  }

  const target = provider === "facebook" ? connection.pageId : connection.igUserId;
  if (!target || !connection.accessToken) {
    await prisma.socialPost.create({
      data: {
        mediaId: media.id,
        provider,
        target: target ?? "",
        caption,
        status: "failed",
        error: "not connected",
      },
    });
    revalidatePath("/settings/connections");
    return { ok: false, error: "not connected" };
  }

  // Instagram fetches the media from a public image_url/video_url, so a
  // reachable public https base URL is mandatory.
  if (provider === "instagram" && !publicUrlIsReachable()) {
    const error =
      "Instagram requires a public https base URL (set PUBLIC_BASE_URL via a tunnel).";
    await prisma.socialPost.create({
      data: {
        mediaId: media.id,
        provider,
        target,
        caption,
        status: "failed",
        error,
      },
    });
    revalidatePath("/settings/connections");
    return { ok: false, error };
  }

  const mediaUrl = storage.publicUrl(media.webPath ?? media.filePath);

  try {
    const result = await getPublisher(provider).publish({
      mediaUrl,
      mediaType: media.type,
      caption,
      targetId: target,
      accessToken: connection.accessToken,
    });

    await prisma.socialPost.create({
      data: {
        mediaId: media.id,
        provider,
        target,
        caption,
        status: "published",
        externalId: result.externalId,
        permalink: result.permalink,
      },
    });
    revalidatePath("/settings/connections");
    return { ok: true, permalink: result.permalink };
  } catch (err) {
    const message =
      err instanceof SocialError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Publishing failed.";
    await prisma.socialPost.create({
      data: {
        mediaId: media.id,
        provider,
        target,
        caption,
        status: "failed",
        error: message,
      },
    });
    revalidatePath("/settings/connections");
    return { ok: false, error: message };
  }
}
