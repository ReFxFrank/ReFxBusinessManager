import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared";
import { PurchaseForm } from "../purchase-form";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const [items, suppliers] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, avgCost: true, quantity: true },
    }),
    prisma.contact.findMany({
      where: { type: { in: ["supplier", "both"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to purchases
      </Link>
      <PageHeader title="New purchase / stock receipt" description="Receiving stock increases quantity and recomputes the moving-average cost." />
      <PurchaseForm items={items} suppliers={suppliers} />
    </div>
  );
}
