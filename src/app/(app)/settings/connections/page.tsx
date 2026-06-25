import Link from "next/link";
import { Facebook, Instagram, Share2, CheckCircle2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { config, publicUrlIsReachable } from "@/lib/config";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

const REQUIRED_ENV: { name: string; desc: string }[] = [
  { name: "META_APP_ID", desc: "Your Meta app's App ID (from developers.facebook.com)." },
  { name: "META_APP_SECRET", desc: "The app secret used to exchange OAuth codes for tokens." },
  {
    name: "META_OAUTH_REDIRECT_URI",
    desc: "Must exactly match a Valid OAuth Redirect URI in the app — typically <base>/api/social/oauth/callback.",
  },
  { name: "META_GRAPH_VERSION", desc: "Graph API version to pin, e.g. v21.0." },
  {
    name: "PUBLIC_BASE_URL",
    desc: "A public https URL for this app (a tunnel in dev). Required for Instagram, which fetches media from a public URL.",
  },
];

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const configured = config.meta.configured;

  const [connections, posts] = await Promise.all([
    prisma.socialConnection.findMany(),
    prisma.socialPost.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  const facebook = connections.find((c) => c.provider === "facebook");
  const instagram = connections.find((c) => c.provider === "instagram");
  const reachable = publicUrlIsReachable();

  const errorMessage =
    sp.error === "not_configured"
      ? "Meta is not configured. Set the required environment variables below."
      : sp.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Connect Facebook & Instagram to publish your media directly from the app. This feature is optional."
      />

      {sp.connected && (
        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Accounts connected successfully.
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {errorMessage}
        </div>
      )}

      {!configured ? (
        <SetupGuidance reachable={reachable} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ConnectionCard
              icon={Facebook}
              title="Facebook Page"
              connected={facebook?.status === "connected"}
              detail={facebook?.pageName ?? null}
              provider="facebook"
              label="Facebook"
            />
            <ConnectionCard
              icon={Instagram}
              title="Instagram"
              connected={instagram?.status === "connected"}
              detail={instagram?.igUsername ? `@${instagram.igUsername}` : null}
              provider="instagram"
              label="Instagram"
            />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Connect Facebook &amp; Instagram</p>
                <p className="text-sm text-muted-foreground">
                  Authorize the app once to discover your Page and linked Instagram account.
                </p>
              </div>
              <Button asChild>
                <Link href="/api/social/oauth/start">
                  <Share2 className="h-4 w-4" />
                  Connect Facebook &amp; Instagram
                </Link>
              </Button>
            </CardContent>
          </Card>

          {!reachable && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              PUBLIC_BASE_URL ({config.publicBaseUrl}) is not a public https URL. Facebook may
              still work, but Instagram publishing requires a public URL (use a tunnel).
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          To publish a specific photo or video, use the <strong>Share</strong> action on each
          item&apos;s media gallery. When accounts are connected you can publish directly;
          otherwise you can copy the caption and post manually.
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Recent posts</h2>
        {posts.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No posts yet"
            description="Published and failed attempts will appear here."
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead>Link / Error</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="capitalize">{p.provider}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.target || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {p.caption || "—"}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {p.permalink ? (
                        <Link
                          href={p.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      ) : p.error ? (
                        <span className="text-destructive">{p.error}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(p.createdAt, true)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}

function ConnectionCard({
  icon: Icon,
  title,
  connected,
  detail,
  provider,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  connected: boolean;
  detail: string | null;
  provider: string;
  label: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <StatusBadge status={connected ? "connected" : "disconnected"} />
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {connected ? detail ?? "Connected" : "Not connected"}
        </p>
        {connected && <DisconnectButton provider={provider} label={label} />}
      </CardContent>
    </Card>
  );
}

function SetupGuidance({ reachable }: { reachable: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up Meta (Facebook & Instagram)</CardTitle>
        <CardDescription>
          This optional feature is disabled until the Meta app credentials are configured. Set
          the following environment variables and restart the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {REQUIRED_ENV.map((env) => (
            <li key={env.name} className="text-sm">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{env.name}</code>
              <span className="ml-2 text-muted-foreground">{env.desc}</span>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>App Review:</strong> publishing for non-test users requires Meta App Review of
            the publishing permissions. Until approved, only app admins/testers can publish.
          </p>
          <p>
            <strong>Instagram:</strong> requires an Instagram Business or Creator account linked to
            a Facebook Page, plus a public https URL (Instagram fetches media from{" "}
            <code className="font-mono text-xs">PUBLIC_BASE_URL</code>).
          </p>
          <p>
            <strong>Public URL status:</strong>{" "}
            {reachable ? (
              <span className="text-success">
                {config.publicBaseUrl} looks publicly reachable.
              </span>
            ) : (
              <span className="text-warning">
                {config.publicBaseUrl} is not a public https URL. Use a tunnel for Instagram.
              </span>
            )}
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="https://developers.facebook.com/" target="_blank" rel="noreferrer">
            Open developers.facebook.com
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
