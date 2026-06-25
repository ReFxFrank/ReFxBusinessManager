"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseMoney } from "@/lib/money";
import { expenseSchema } from "@/lib/validation";

export type ActionState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodToState(error: import("zod").ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  await prisma.expense.create({
    data: {
      date: new Date(v.date),
      category: v.category,
      amount: parseMoney(v.amount),
      kind: v.kind,
      note: v.note || null,
      status: v.status,
    },
  });

  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateExpense(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  await prisma.expense.update({
    where: { id },
    data: {
      date: new Date(v.date),
      category: v.category,
      amount: parseMoney(v.amount),
      kind: v.kind,
      note: v.note || null,
      status: v.status,
    },
  });

  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<void> {
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
}
