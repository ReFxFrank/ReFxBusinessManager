"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { formatMoney, parseMoney } from "@/lib/money";
import { toDateInputValue } from "@/lib/utils";
import { submitPurchase } from "./actions";

export interface PurchaseItemOption {
  id: string;
  name: string;
  unit: string;
  avgCost: number;
  quantity: number;
}

interface Line {
  key: number;
  itemId: string;
  qty: string;
  unitCost: string;
}

let keyCounter = 1;
const newLine = (): Line => ({ key: keyCounter++, itemId: "", qty: "1", unitCost: "" });

export function PurchaseForm({
  items,
  suppliers,
}: {
  items: PurchaseItemOption[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [lines, setLines] = React.useState<Line[]>([newLine()]);
  const [contactId, setContactId] = React.useState("");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [status, setStatus] = React.useState<"paid" | "unpaid">("paid");
  const [notes, setNotes] = React.useState("");
  const [pending, start] = React.useTransition();

  const itemMap = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function selectItem(key: number, itemId: string) {
    const item = itemMap.get(itemId);
    updateLine(key, { itemId, unitCost: item ? formatMoney(item.avgCost, { showSymbol: false }) : "" });
  }

  const totals = lines.map((l) => Math.round((Number(l.qty) || 0) * parseMoney(l.unitCost || "0")));
  const grandTotal = totals.reduce((s, t) => s + t, 0);

  function doSubmit() {
    start(async () => {
      const res = await submitPurchase({
        contactId,
        date,
        status,
        notes,
        lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unitCost: l.unitCost })),
      });
      if (res.ok) {
        toast({ title: "Purchase recorded — stock & avg cost updated", variant: "success" });
        router.push(`/purchases/${res.purchaseId}`);
        router.refresh();
      } else {
        toast({ title: res.error ?? "Failed", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {suppliers.map((c) => (
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
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "paid" | "unpaid")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid (payable)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_90px_120px_120px_40px]">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit cost</span>
            <span className="text-right">Line total</span>
            <span></span>
          </div>
          {lines.map((line, idx) => {
            const item = itemMap.get(line.itemId);
            return (
              <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_90px_120px_120px_40px] sm:items-center">
                <Select value={line.itemId} onValueChange={(v) => selectItem(line.key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} · {i.quantity} {i.unit}
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
                  value={line.unitCost}
                  onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                  className="text-right"
                  placeholder="0.00"
                />
                <div className="text-right text-sm tabular-nums">{formatMoney(totals[idx])}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev))}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                {item && (
                  <p className="col-span-full -mt-1 text-xs text-muted-foreground">
                    Current avg cost {formatMoney(item.avgCost)} — receiving stock recomputes the moving average.
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

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Total cost: </span>
          <span className="font-semibold tabular-nums">{formatMoney(grandTotal)}</span>
        </div>
        <Button disabled={pending} onClick={doSubmit}>
          {pending ? "Saving…" : "Record purchase"}
        </Button>
      </div>
    </div>
  );
}
