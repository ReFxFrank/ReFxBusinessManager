import * as React from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Delta line: "↑ 12.5% vs last month", colored good/bad by metric semantics. */
export function DeltaLine({
  delta,
  goodWhenUp,
  compareLabel,
}: {
  delta: number | null;
  goodWhenUp: boolean;
  compareLabel: string;
}) {
  if (delta === null) return <p className="mt-1 text-[11px] text-muted-foreground">{compareLabel}</p>;
  const up = delta >= 0;
  const good = up === goodWhenUp;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <p className={cn("mt-1 flex items-center gap-0.5 text-[11px] font-medium", good ? "text-success" : "text-destructive")}>
      <Arrow className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
      <span className="font-normal text-muted-foreground"> {compareLabel}</span>
    </p>
  );
}

/** A dashboard overview tile: icon + label, big value, and a delta or sub line. */
export function MetricCard({
  label,
  value,
  icon: Icon,
  delta,
  goodWhenUp = true,
  compareLabel = "",
  sub,
  href,
  alert,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: number | null;
  goodWhenUp?: boolean;
  compareLabel?: string;
  sub?: React.ReactNode;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div className="flex h-full flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            alert ? "bg-destructive/10 text-destructive" : "bg-accent text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {delta !== undefined ? (
        <DeltaLine delta={delta ?? null} goodWhenUp={goodWhenUp} compareLabel={compareLabel} />
      ) : sub ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
