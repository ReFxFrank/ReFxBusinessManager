"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteExpense } from "./actions";
import { ExpenseFormDialog } from "./expense-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExpenseRow {
  id: string;
  date: Date | string;
  category: string;
  amount: number;
  kind: "expense" | "income";
  note: string | null;
  status: "paid" | "unpaid";
}

export function ExpenseRowActions({ expense }: { expense: ExpenseRow }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function onDelete() {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteExpense(expense.id);
        toast({ title: "Entry deleted", variant: "success" });
        router.refresh();
      } catch {
        toast({ title: "Could not delete entry", variant: "destructive" });
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ExpenseFormDialog
          expense={expense}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
