"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validation";
import { createExpense, updateExpense, type ActionState } from "./actions";
import { Field } from "@/app/(app)/inventory/item-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toDateInputValue } from "@/lib/utils";

interface ExpenseLike {
  id: string;
  date: Date | string;
  category: string;
  amount: number;
  kind: "expense" | "income";
  note: string | null;
  status: "paid" | "unpaid";
}

const COMMON_CATEGORIES = [
  "Rent",
  "Wages",
  "Utilities",
  "Packaging",
  "Marketing",
  "Platform fees",
];

export function ExpenseFormDialog({
  expense,
  trigger,
}: {
  expense?: ExpenseLike;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(expense);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: expense ? toDateInputValue(expense.date) : toDateInputValue(new Date()),
      category: expense?.category ?? "",
      amount: expense ? formatMoney(expense.amount, { showSymbol: false }) : "",
      kind: expense?.kind ?? "expense",
      note: expense?.note ?? "",
      status: expense?.status ?? "paid",
    },
  });

  function onSubmit(values: ExpenseFormValues) {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    startTransition(async () => {
      const action = editing ? updateExpense.bind(null, expense!.id) : createExpense;
      const res: ActionState = await action({ ok: false }, fd);
      if (res.ok) {
        toast({ title: editing ? "Expense updated" : "Expense created", variant: "success" });
        setOpen(false);
        form.reset(values);
        router.refresh();
      } else {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof ExpenseFormValues, { message: msg });
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
            {editing ? "Edit" : "New expense"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "New expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={form.formState.errors.date?.message}>
              <Input type="date" {...form.register("date")} />
            </Field>
            <Field label="Amount" error={form.formState.errors.amount?.message}>
              <Input {...form.register("amount")} placeholder="0.00" inputMode="decimal" />
            </Field>
          </div>
          <Field label="Category" error={form.formState.errors.category?.message}>
            <Input
              {...form.register("category")}
              placeholder="e.g. Rent"
              list="expense-categories"
            />
            <datalist id="expense-categories">
              {COMMON_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" error={form.formState.errors.kind?.message}>
              <Select
                defaultValue={form.getValues("kind")}
                onValueChange={(v) => form.setValue("kind", v as ExpenseFormValues["kind"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" error={form.formState.errors.status?.message}>
              <Select
                defaultValue={form.getValues("status")}
                onValueChange={(v) => form.setValue("status", v as ExpenseFormValues["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Note">
            <Textarea {...form.register("note")} rows={2} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
