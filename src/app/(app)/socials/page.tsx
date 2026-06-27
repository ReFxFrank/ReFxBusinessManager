import Link from "next/link";
import { Facebook, Instagram, Send, Share2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { formatDate } from "@/lib/utils";
import { MetricCard } from "@/components/metric-card";
import { EmptyState, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SocialsPage() {
  const [connections, posts, publishedCount, connectedCount] = await Promise.all([
    prisma.socialConnection.findMany(),
    prisma.socialPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { media: true },
    }),
    prisma.socialPost.count({ where: { status: "published" } }),
    prisma.socialConnection.count({ where: { status: "connected" } }),
  ]);

  const facebook = connections.find((c) => c.provider === "facebook");
  const instagram = connections.find((c) => c.provider === "instagram");
  const showHint = !config.meta.configured || connectedCount === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Socials</h1>

      {/* Connection status */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Connections</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-primary">
                <Facebook className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Facebook</span>
            </div>
            <div className="mt-2">
              <StatusBadge status={facebook?.status ?? "disconnected"} />
            </div>
            {facebook?.pageName && (
              <p className="mt-2 truncate text-xs text-muted-foreground">{facebook.pageName}</p>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-primary">
                <Instagram className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Instagram</span>
            </div>
            <div className="mt-2">
              <StatusBadge status={instagram?.status ?? "disconnected"} />
            </div>
            {instagram?.igUsername && (
              <p className="mt-2 truncate text-xs text-muted-foreground">@{instagram.igUsername}</p>
            )}
          </div>
        </div>

        {showHint && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium">Connect your Facebook Page &amp; Instagram to publish.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Link your accounts to share product photos directly from the app.
            </p>
            <Button asChild className="mt-3 w-full">
              <Link href="/settings/connections">Set up connections</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Post Performance */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Post Performance</h2>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Published" value={String(publishedCount)} icon={Send} sub="Posts shared" />
          <MetricCard label="Connected" value={String(connectedCount)} icon={Share2} sub="Active accounts" />
        </div>
      </section>

      {/* Recent Posts */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Recent Posts</h2>
        {posts.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {posts.map((post, i) => {
              const Icon = post.provider === "instagram" ? Instagram : Facebook;
              const caption = post.caption?.trim() ? post.caption : "(no caption)";
              const rowClass = `flex items-center gap-3 px-4 py-3 hover:bg-accent/50 ${i > 0 ? "border-t" : ""}`;
              const content = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{caption}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {post.provider} · {post.target} · {formatDate(post.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </>
              );
              return post.permalink ? (
                <Link
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClass}
                >
                  {content}
                </Link>
              ) : (
                <div key={post.id} className={rowClass}>
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Share2}
            title="No posts yet"
            description="Share a product photo from the Gallery."
          />
        )}
      </section>

      <Button asChild className="w-full">
        <Link href="/gallery">Create Post</Link>
      </Button>
    </div>
  );
}
