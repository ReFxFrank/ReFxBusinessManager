"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Plug, Unplug, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  connectShopify,
  connectEtsy,
  disconnect,
  setTwoWay,
  syncNow,
  type IntegrationResult,
} from "./actions";

type Provider = "shopify" | "etsy";

export interface ConnInfo {
  status: string;
  shopName: string | null;
  twoWay: boolean;
  lastSyncedAt: string | null;
}

export function IntegrationCard({
  provider,
  name,
  available,
  connection,
  setupHint,
}: {
  provider: Provider;
  name: string;
  available: boolean;
  connection: ConnInfo | null;
  setupHint?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const connected = connection?.status === "connected";

  function run(fn: () => Promise<IntegrationResult | void>, fallback = "Done") {
    start(async () => {
      const res = await fn();
      if (res && "ok" in res) {
        toast({ title: res.ok ? res.message ?? fallback : res.error ?? "Failed", variant: res.ok ? "success" : "destructive" });
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Plug className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{connected ? connection?.shopName ?? "Connected" : "Not connected"}</p>
          </div>
        </div>
        <Badge variant={connected ? "success" : "secondary"}>{connection?.status ?? "disconnected"}</Badge>
      </div>

      {!available && (
        <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{setupHint}</p>
      )}

      {available && !connected && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => (provider === "shopify" ? connectShopify({ ok: false }, fd) : connectEtsy({ ok: false }, fd)), "Connected");
          }}
        >
          {provider === "shopify" ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Shop domain</Label>
                <Input name="shopDomain" placeholder="your-shop.myshopify.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Admin API access token</Label>
                <Input name="accessToken" type="password" placeholder="shpat_…" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Etsy shop id</Label>
                <Input name="shopId" placeholder="12345678" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">OAuth access token</Label>
                <Input name="accessToken" type="password" placeholder="Bearer token" />
              </div>
            </>
          )}
          <Button type="submit" size="sm" disabled={pending} className="w-full">
            {pending ? "Connecting…" : "Connect"}
          </Button>
        </form>
      )}

      {connected && (
        <div className="mt-3 space-y-3">
          <button
            onClick={() => run(() => setTwoWay(provider, !connection?.twoWay), "Updated")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-colors",
              connection?.twoWay ? "border-primary bg-accent" : "bg-background",
            )}
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Two-way sync (push out)
            </span>
            <span className={cn("text-xs font-semibold", connection?.twoWay ? "text-primary" : "text-muted-foreground")}>
              {connection?.twoWay ? "ON" : "OFF"}
            </span>
          </button>

          <div className="flex gap-2">
            <Button size="sm" disabled={pending} className="flex-1" onClick={() => run(() => syncNow(provider), "Synced")}>
              <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} /> Sync now
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (confirm(`Disconnect ${name}?`)) run(() => disconnect(provider), "Disconnected");
              }}
            >
              <Unplug className="h-4 w-4" /> Disconnect
            </Button>
          </div>
          {connection?.lastSyncedAt && (
            <p className="text-[11px] text-muted-foreground">Last synced {formatDate(connection.lastSyncedAt, true)}</p>
          )}
        </div>
      )}
    </div>
  );
}
