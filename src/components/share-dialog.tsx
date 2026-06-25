"use client";

import * as React from "react";
import Link from "next/link";
import { Share2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { publishMedia, type PublishActionResult } from "@/app/(app)/settings/connections/actions";
import type { SocialProvider } from "@/lib/social/types";

interface ShareDialogProps {
  mediaId: string;
  defaultCaption: string;
  configured: boolean;
  fbConnected: boolean;
  igConnected: boolean;
  trigger?: React.ReactNode;
}

interface ResultLine {
  provider: SocialProvider;
  result: PublishActionResult;
}

/**
 * Reusable "Share to social" dialog, intended to be mounted from each item's
 * media gallery (wired in by another part of the build).
 *
 * - When Meta is configured AND at least one account is connected, it offers
 *   direct publishing to the connected providers.
 * - Otherwise it degrades gracefully to a copy-caption + open-platform flow.
 *   It never throws.
 */
export function ShareDialog({
  mediaId,
  defaultCaption,
  configured,
  fbConnected,
  igConnected,
  trigger,
}: ShareDialogProps) {
  const [open, setOpen] = React.useState(false);
  const canPublish = configured && (fbConnected || igConnected);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share to social</DialogTitle>
          <DialogDescription>
            {canPublish
              ? "Publish this media directly to your connected accounts."
              : "Copy the caption and post manually on each platform."}
          </DialogDescription>
        </DialogHeader>
        {canPublish ? (
          <PublishForm
            mediaId={mediaId}
            defaultCaption={defaultCaption}
            fbConnected={fbConnected}
            igConnected={igConnected}
          />
        ) : (
          <FallbackShare defaultCaption={defaultCaption} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PublishForm({
  mediaId,
  defaultCaption,
  fbConnected,
  igConnected,
}: {
  mediaId: string;
  defaultCaption: string;
  fbConnected: boolean;
  igConnected: boolean;
}) {
  const [caption, setCaption] = React.useState(defaultCaption);
  const [fb, setFb] = React.useState(fbConnected);
  const [ig, setIg] = React.useState(igConnected);
  const [pending, startTransition] = React.useTransition();
  const [results, setResults] = React.useState<ResultLine[]>([]);
  const { toast } = useToast();

  function onPublish() {
    const targets: SocialProvider[] = [];
    if (fb && fbConnected) targets.push("facebook");
    if (ig && igConnected) targets.push("instagram");
    if (targets.length === 0) {
      toast({ title: "Select at least one account", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const collected: ResultLine[] = [];
      for (const provider of targets) {
        const result = await publishMedia(mediaId, provider, caption);
        collected.push({ provider, result });
        if (result.ok) {
          toast({ title: `Published to ${label(provider)}`, variant: "success" });
        } else {
          toast({
            title: `${label(provider)} failed`,
            description: result.error,
            variant: "destructive",
          });
        }
      }
      setResults(collected);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Post to</Label>
        <div className="flex flex-col gap-2">
          {fbConnected && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fb}
                onChange={(e) => setFb(e.target.checked)}
                className="h-4 w-4"
              />
              Facebook Page
            </label>
          )}
          {igConnected && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ig}
                onChange={(e) => setIg(e.target.checked)}
                className="h-4 w-4"
              />
              Instagram
            </label>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="share-caption">Caption</Label>
        <Textarea
          id="share-caption"
          rows={4}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-1 rounded-md border p-3 text-sm">
          {results.map(({ provider, result }) => (
            <div key={provider} className="flex items-center justify-between gap-2">
              <span className="font-medium">{label(provider)}</span>
              {result.ok ? (
                result.permalink ? (
                  <Link
                    href={result.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    View post <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-success">Published</span>
                )
              ) : (
                <span className="text-destructive">{result.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <DialogFooter>
        <Button onClick={onPublish} disabled={pending}>
          {pending ? "Publishing…" : "Publish"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function FallbackShare({ defaultCaption }: { defaultCaption: string }) {
  const { toast } = useToast();

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(defaultCaption);
      toast({ title: "Caption copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy caption", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Caption</Label>
        <Textarea readOnly rows={4} value={defaultCaption} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyCaption}>
          <Copy className="h-4 w-4" />
          Copy caption
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="https://www.facebook.com" target="_blank" rel="noreferrer">
            Open Facebook <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="https://www.instagram.com" target="_blank" rel="noreferrer">
            Open Instagram <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect accounts in Settings → Connections to publish directly.
      </p>
    </div>
  );
}

function label(provider: SocialProvider): string {
  return provider === "facebook" ? "Facebook" : "Instagram";
}
