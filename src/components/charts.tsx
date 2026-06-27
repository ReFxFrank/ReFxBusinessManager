"use client";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";

interface TrendPoint {
  date: string;
  revenue: number; // cents
  grossProfit: number; // cents
}

const fmtAxis = (cents: number) => `$${Math.round(cents / 100)}`;
const fmtDate = (d: string) => d.slice(5); // MM-DD

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueProfitChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
        <Tooltip content={<TooltipBox />} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(221 83% 53%)" fill="url(#rev)" strokeWidth={2} />
        <Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke="hsl(142 71% 45%)" fill="url(#prof)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Compact single-series area chart for the Dashboard/Finances overview cards. */
export function SparkAreaChart({
  data,
  dataKey = "value",
  color = "hsl(var(--primary))",
  height = 150,
}: {
  data: Record<string, number | string>[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.28} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={28} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipBox />} />
        <Area type="monotone" dataKey={dataKey} name="Revenue" stroke={color} strokeWidth={2.2} fill={`url(#spark-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MarginTrendChart({ data }: { data: { date: string; margin: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={40} />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, "Gross margin"]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Line type="monotone" dataKey="margin" name="Gross margin" stroke="hsl(262 83% 58%)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data }: { data: { category: string; grossProfit: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={90} stroke="hsl(var(--muted-foreground))" />
        <Tooltip content={<TooltipBox />} />
        <Bar dataKey="grossProfit" name="Gross profit" fill="hsl(221 83% 53%)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
