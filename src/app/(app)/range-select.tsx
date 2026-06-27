"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

const OPTIONS: { value: string; label: string }[] = [
  { value: "month", label: "This Month" },
  { value: "30d", label: "Last 30 Days" },
  { value: "year", label: "This Year" },
];

/** Pill-styled period selector that updates the ?range query param on `basePath`. */
export function RangeSelect({ value, basePath = "/" }: { value: string; basePath?: string }) {
  const router = useRouter();
  return (
    <div className="relative inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
      <span>{OPTIONS.find((o) => o.value === value)?.label ?? "This Month"}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        aria-label="Select period"
        value={value}
        onChange={(e) => router.push(`${basePath}?range=${e.target.value}`)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
