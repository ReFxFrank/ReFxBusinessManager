import { Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard, StatusBadge } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseFormDialog } from "./expense-form";
import { ExpenseRowActions } from "./row-actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, number | null> = {
  "30": 30,
  "90": 90,
  "365": 365,
  all: null,
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; category?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const kind = sp.kind === "expense" || sp.kind === "income" ? sp.kind : "";
  const category = sp.category ?? "";
  const period = sp.period && sp.period in PERIODS ? sp.period : "90";

  const days = PERIODS[period];
  const fromDate = days === null ? undefined : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Prisma.ExpenseWhereInput = {
    ...(kind ? { kind } : {}),
    ...(category ? { category } : {}),
    ...(fromDate ? { date: { gte: fromDate } } : {}),
  };

  const [expenses, categoryRows] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { date: "desc" } }),
    prisma.expense.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);

  const totalExpenses = expenses
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const totalIncome = expenses
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + e.amount, 0);
  const unpaidPayables = expenses
    .filter((e) => e.kind === "expense" && e.status === "unpaid")
    .reduce((s, e) => s + e.amount, 0);

  const periodLabel = days === null ? "all time" : `last ${days} days`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses & income"
        description={`${expenses.length} entries · ${periodLabel}`}
        action={<ExpenseFormDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Expenses" value={formatMoney(totalExpenses)} accent="destructive" sub={periodLabel} />
        <StatCard label="Other income" value={formatMoney(totalIncome)} accent="success" sub={periodLabel} />
        <StatCard
          label="Unpaid payables"
          value={formatMoney(unpaidPayables)}
          accent={unpaidPayables > 0 ? "warning" : "default"}
          sub="open expenses"
        />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <select
          name="kind"
          defaultValue={kind}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All kinds</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select
          name="category"
          defaultValue={category}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categoryRows.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category}
            </option>
          ))}
        </select>
        <select
          name="period"
          defaultValue={period}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
          <option value="all">All time</option>
        </select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={kind || category ? "No entries match your filters" : "No entries yet"}
          description="Record an expense or other income to track non-inventory cashflow."
          action={<ExpenseFormDialog />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => {
                const isExpense = e.kind === "expense";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                    <TableCell className="font-medium">{e.category}</TableCell>
                    <TableCell>
                      <Badge variant={isExpense ? "secondary" : "success"}>{e.kind}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${isExpense ? "text-destructive" : "text-success"}`}
                    >
                      {isExpense ? `−${formatMoney(e.amount)}` : formatMoney(e.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{e.note ?? ""}</TableCell>
                    <TableCell>
                      <ExpenseRowActions expense={e} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
