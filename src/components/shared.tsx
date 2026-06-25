import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney, formatPct } from "@/lib/money";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground" />}
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  accent?: "default" | "success" | "destructive" | "warning";
  href?: string;
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "destructive"
        ? "text-destructive"
        : accent === "warning"
          ? "text-warning"
          : "text-foreground";
  const inner = (
    <Card className={cn(href && "transition-colors hover:bg-accent")}>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold tabular-nums", accentClass)}>{value}</p>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Colored money — green positive, red negative. */
export function Money({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", cents < 0 && "text-destructive", className)}>
      {formatMoney(cents)}
    </span>
  );
}

/** Margin badge — colored by health. Negative = red, low = amber, healthy = green. */
export function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-muted-foreground">—</span>;
  const variant = margin < 0 ? "destructive" : margin < 15 ? "warning" : "success";
  return <Badge variant={variant}>{formatPct(margin)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "success" | "warning" | "secondary"> = {
    paid: "success",
    unpaid: "warning",
    published: "success",
    failed: "secondary",
    pending: "secondary",
    connected: "success",
    disconnected: "secondary",
  };
  return <Badge variant={map[status] ?? "secondary"}>{status}</Badge>;
}
