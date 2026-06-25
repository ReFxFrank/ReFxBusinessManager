import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared";
import { SaleForm } from "../sale-form";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const [items, contacts] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, salePrice: true, avgCost: true, quantity: true, unit: true },
    }),
    prisma.contact.findMany({
      where: { type: { in: ["customer", "both"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sales
      </Link>
      <PageHeader title="New sale" description="Record a sale — COGS is snapshotted at the moving-average cost and profit is locked in." />
      <SaleForm items={items} contacts={contacts} />
    </div>
  );
}
