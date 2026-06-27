import { Plug, ArrowRightLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { providerAvailable } from "@/lib/integrations";
import { formatDate } from "@/lib/utils";
import { EmptyState, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { IntegrationCard, type ConnInfo } from "./integration-card";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const [connections, logs, sourceCounts] = await Promise.all([
    prisma.integrationConnection.findMany(),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.sale.groupBy({ by: ["source"], _count: { _all: true }, _sum: { revenue: true } }),
  ]);

  const byProvider = (p: string): ConnInfo | null => {
    const c = connections.find((x) => x.provider === p);
    if (!c) return null;
    return { status: c.status, shopName: c.shopName, twoWay: c.twoWay, lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect Shopify &amp; Etsy to import orders/products and (two-way) push changes out.</p>
      </div>

      {/* Connection cards */}
      <section className="space-y-3">
        <IntegrationCard provider="shopify" name="Shopify" available={providerAvailable("shopify")} connection={byProvider("shopify")} />
        <IntegrationCard
          provider="etsy"
          name="Etsy"
          available={providerAvailable("etsy")}
          connection={byProvider("etsy")}
          setupHint="Set ETSY_KEYSTRING (your Etsy app's x-api-key) in .env to enable Etsy. Etsy production access also requires Etsy app review; dev/personal access works immediately."
        />
      </section>

      {/* Platform comparison (revenue by source) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Sales by channel</h2>
        <div className="grid grid-cols-3 gap-3">
          {["manual", "shopify", "etsy"].map((src) => {
            const row = sourceCounts.find((s) => s.source === src);
            return (
              <div key={src} className="rounded-2xl border bg-card p-3 text-center shadow-sm">
                <p className="text-xs capitalize text-muted-foreground">{src}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{row?._count._all ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">${(((row?._sum.revenue ?? 0) as number) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sync log */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Sync activity</h2>
        {logs.length === 0 ? (
          <EmptyState icon={ArrowRightLeft} title="No sync activity yet" description="Connect a platform and tap Sync now." />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {logs.map((l, i) => (
              <div key={l.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i > 0 ? "border-t" : ""}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Plug className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {l.provider} · {l.direction} {l.entityType} {l.action}
                  </p>
                  {l.message && <p className="truncate text-xs text-muted-foreground">{l.message}</p>}
                </div>
                <div className="text-right">
                  <Badge variant={l.status === "ok" ? "success" : "destructive"}>{l.status}</Badge>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(l.createdAt, true)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Tip: imported items start with unknown cost (0), so record a purchase or set the average cost to get accurate profit on
        imported orders. Status: <StatusBadge status={config.integrations.etsy.configured ? "connected" : "disconnected"} /> Etsy env.
      </p>
    </div>
  );
}
