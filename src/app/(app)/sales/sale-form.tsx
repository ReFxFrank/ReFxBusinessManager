"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatMoney, parseMoney, marginPct, formatPct } from "@/lib/money";
import { toDateInputValue } from "@/lib/utils";
import { submitSale } from "./actions";

export interface SaleItemOption {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  avgCost: number;
  quantity: number;
  unit: string;
}

interface Line {
  key: number;
  itemId: string;
  qty: string;
  unitSalePrice: string;
}

let keyCounter = 1;
const newLine = (): Line => ({ key: keyCounter++, itemId: "", qty: "1", unitSalePrice: "" });

export function SaleForm({
  items,
  contacts,
}: {
  items: SaleItemOption[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [lines, setLines] = React.useState<Line[]>([newLine()]);
  const [contactId, setContactId] = React.useState("");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [status, setStatus] = React.useState<"paid" | "unpaid">("paid");
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [notes, setNotes] = React.useState("");
  const [pending, start] = React.useTransition();
  const [oversell, setOversell] = React.useState<
    { name: string; requested: number; available: number }[] | null
  >(null);

  const itemMap = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function selectItem(key: number, itemId: string) {
    const item = itemMap.get(itemId);
    updateLine(key, {
      itemId,
      unitSalePrice: item ? formatMoney(item.salePrice, { showSymbol: false }) : "",
    });
  }

  const computed = lines.map((l) => {
    const item = itemMap.get(l.itemId);
    const qty = Number(l.qty) || 0;
    const price = parseMoney(l.unitSalePrice || "0");
    const cost = item?.avgCost ?? 0;
    const revenue = Math.round(qty * price);
    const profit = revenue - Math.round(qty * cost);
    const overselling = item ? qty > item.quantity : false;
    return { revenue, profit, overselling, available: item?.quantity ?? 0 };
  });

  const totalRevenue = computed.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = computed.reduce((s, c) => s + c.profit, 0);
  const anyOversell = computed.some((c) => c.overselling);

  function doSubmit(allowOversell: boolean) {
    start(async () => {
      const res = await submitSale({
        contactId,
        date,
        status,
        paymentMethod,
        notes,
        allowOversell,
        lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unitSalePrice: l.unitSalePrice })),
      });
      if (res.ok) {
        toast({ title: "Sale recorded", variant: "success" });
        router.push(`/sales/${res.saleId}`);
        router.refresh();
      } else if (res.oversell) {
        setOversell(res.oversell);
        toast({ title: res.error ?? "Stock check failed", variant: "destructive" });
      } else {
        toast({ title: res.error ?? "Failed", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Walk-in" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Walk-in / none</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["cash", "card", "transfer", "other"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "paid" | "unpaid")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid (receivable)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_90px_120px_110px_110px_40px]">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Revenue</span>
            <span className="text-right">Est. profit</span>
            <span></span>
          </div>
          {lines.map((line, idx) => {
            const c = computed[idx];
            const item = itemMap.get(line.itemId);
            return (
              <div
                key={line.key}
                className="grid gap-2 sm:grid-cols-[1fr_90px_120px_110px_110px_40px] sm:items-center"
              >
                <Select value={line.itemId} onValueChange={(v) => selectItem(line.key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} · {i.quantity} {i.unit} in stock
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={line.qty}
                  onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                  className="text-right"
                />
                <Input
                  inputMode="decimal"
                  value={line.unitSalePrice}
                  onChange={(e) => updateLine(line.key, { unitSalePrice: e.target.value })}
                  className="text-right"
                  placeholder="0.00"
                />
                <div className="text-right text-sm tabular-nums">{formatMoney(c.revenue)}</div>
                <div className={`text-right text-sm tabular-nums ${c.profit < 0 ? "text-destructive" : "text-success"}`}>
                  {formatMoney(c.profit)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev))}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                {c.overselling && (
                  <p className="col-span-full -mt-1 flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Only {c.available} {item?.unit} available — selling more will take stock negative.
                  </p>
                )}
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine()])}>
            <Plus /> Add line
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      {oversell && (
        <Card className="border-warning">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="h-4 w-4" /> Overselling warning
            </p>
            <ul className="list-inside list-disc text-muted-foreground">
              {oversell.map((o) => (
                <li key={o.name}>
                  {o.name}: requested {o.requested}, only {o.available} available.
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              You can cancel and adjust quantities, or proceed and allow stock to go negative.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOversell(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" disabled={pending} onClick={() => doSubmit(true)}>
                Sell anyway
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Total revenue: </span>
            <span className="font-semibold tabular-nums">{formatMoney(totalRevenue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Est. gross profit: </span>
            <span className="font-semibold tabular-nums">{formatMoney(totalProfit)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Margin: </span>
            <span className="font-semibold tabular-nums">{formatPct(marginPct(totalProfit, totalRevenue))}</span>
          </div>
        </div>
        <Button disabled={pending} onClick={() => doSubmit(false)}>
          {pending ? "Saving…" : anyOversell ? "Record sale (will warn)" : "Record sale"}
        </Button>
      </div>
    </div>
  );
}
