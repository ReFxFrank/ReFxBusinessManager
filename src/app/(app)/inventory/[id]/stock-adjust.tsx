"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "../item-form";
import { useToast } from "@/components/ui/toast";
import { adjustItemStock, type ActionState } from "../actions";

export function StockAdjustDialog({ itemId, unit }: { itemId: string; unit: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res: ActionState = await adjustItemStock(itemId, { ok: false }, fd);
      if (res.ok) {
        toast({ title: "Stock adjusted", variant: "success" });
        setOpen(false);
        setErrors({});
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast({ title: res.error ?? "Failed", variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sliders /> Adjust stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual stock adjustment</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label={`Change (+/- in ${unit}) — does not affect average cost`} error={errors.change}>
            <Input name="change" type="number" step="any" placeholder="e.g. -2 or 10" autoFocus />
          </Field>
          <Field label="Reason" error={errors.reason}>
            <Input name="reason" placeholder="e.g. Damaged, Stock count correction" />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Apply adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
