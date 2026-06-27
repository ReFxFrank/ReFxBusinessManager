"use client";
import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * iOS-style segmented control that drives a query param (e.g. ?seg=low).
 * Server pages read the param to filter. Purely client navigation.
 */
export function Segmented({
  param,
  value,
  options,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(v: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === options[0].value) sp.delete(param);
    else sp.set(param, v);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-medium">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
