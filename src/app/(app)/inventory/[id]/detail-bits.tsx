import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export { MarginBadge } from "@/components/shared";

export function MoneyStat({
  label,
  value,
  accent,
  node,
}: {
  label: string;
  value: string;
  accent?: "default" | "success" | "destructive" | "warning";
  node?: React.ReactNode;
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "destructive"
        ? "text-destructive"
        : accent === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 text-lg font-bold tabular-nums", accentClass)}>{value}</p>
        {node && <div className="mt-1">{node}</div>}
      </CardContent>
    </Card>
  );
}
