"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { itemSchema, type ItemFormValues } from "@/lib/validation";
import { createItem, updateItem, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";

interface ItemLike {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  salePrice: number;
  avgCost: number;
  quantity: number;
  reorderThreshold: number;
  supplierId: string | null;
  notes: string | null;
}

const UNITS = ["each", "kg", "g", "L", "mL", "m", "cm", "pack", "box", "hour"];

export function ItemFormDialog({
  item,
  suppliers,
  trigger,
}: {
  item?: ItemLike;
  suppliers: { id: string; name: string }[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(item);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: item?.name ?? "",
      sku: item?.sku ?? "",
      category: item?.category ?? "",
      unit: item?.unit ?? "each",
      salePrice: item ? formatMoney(item.salePrice, { showSymbol: false }) : "",
      avgCost: item ? formatMoney(item.avgCost, { showSymbol: false }) : "",
      quantity: item?.quantity ?? 0,
      reorderThreshold: item?.reorderThreshold ?? 0,
      supplierId: item?.supplierId ?? "",
      notes: item?.notes ?? "",
    },
  });

  function onSubmit(values: ItemFormValues) {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    startTransition(async () => {
      const action = editing ? updateItem.bind(null, item!.id) : createItem;
      const res: ActionState = await action({ ok: false }, fd);
      if (res.ok) {
        toast({ title: editing ? "Item updated" : "Item created", variant: "success" });
        setOpen(false);
        form.reset(values);
        router.refresh();
      } else {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof ItemFormValues, { message: msg });
          }
        }
        toast({ title: res.error ?? "Something went wrong", variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            {editing ? <Pencil /> : <Plus />}
            {editing ? "Edit" : "New item"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} placeholder="e.g. Blue Ceramic Mug" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU (optional — auto if blank)" error={form.formState.errors.sku?.message}>
              <Input {...form.register("sku")} placeholder="auto-generated" />
            </Field>
            <Field label="Category" error={form.formState.errors.category?.message}>
              <Input {...form.register("category")} placeholder="e.g. Drinkware" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sale price" error={form.formState.errors.salePrice?.message}>
              <Input {...form.register("salePrice")} placeholder="0.00" inputMode="decimal" />
            </Field>
            <Field label="Unit" error={form.formState.errors.unit?.message}>
              <Select
                defaultValue={form.getValues("unit")}
                onValueChange={(v) => form.setValue("unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opening quantity" error={form.formState.errors.quantity?.message}>
                <Input type="number" step="any" {...form.register("quantity")} />
              </Field>
              <Field label="Opening avg cost" error={form.formState.errors.avgCost?.message}>
                <Input {...form.register("avgCost")} placeholder="0.00" inputMode="decimal" />
              </Field>
            </div>
          )}
          {editing && (
            <Field label="Average cost (system-maintained; edit with care)" error={form.formState.errors.avgCost?.message}>
              <Input {...form.register("avgCost")} placeholder="0.00" inputMode="decimal" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reorder threshold" error={form.formState.errors.reorderThreshold?.message}>
              <Input type="number" step="any" {...form.register("reorderThreshold")} />
            </Field>
            <Field label="Supplier">
              <Select
                defaultValue={form.getValues("supplierId") || "none"}
                onValueChange={(v) => form.setValue("supplierId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea {...form.register("notes")} rows={2} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
