import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState, StatusBadge } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactFormDialog } from "../contact-form";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { date: "desc" },
        take: 20,
        select: { id: true, date: true, revenue: true, grossProfit: true, status: true },
      },
      purchases: {
        orderBy: { date: "desc" },
        take: 20,
        select: { id: true, date: true, total: true, status: true },
      },
      suppliedItems: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, sku: true },
      },
    },
  });

  if (!contact) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={contact.name}
        description={contact.type}
        action={
          <ContactFormDialog
            contact={{
              id: contact.id,
              name: contact.name,
              type: contact.type,
              email: contact.email,
              phone: contact.phone,
              address: contact.address,
              notes: contact.notes,
            }}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Detail label="Email" value={contact.email} />
          <Detail label="Phone" value={contact.phone} />
          <Detail label="Address" value={contact.address} />
          <Detail label="Notes" value={contact.notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.sales.length === 0 ? (
            <EmptyState title="No sales yet" description="Sales to this contact will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contact.sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <Link href={`/sales/${sale.id}`} className="hover:underline">
                        {formatDate(sale.date)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={sale.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sale.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sale.grossProfit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.purchases.length === 0 ? (
            <EmptyState title="No purchases yet" description="Purchases from this contact will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contact.purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <Link href={`/purchases/${purchase.id}`} className="hover:underline">
                        {formatDate(purchase.date)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={purchase.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(purchase.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplied items</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.suppliedItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No supplied items"
              description="Items sourced from this supplier will appear here."
            />
          ) : (
            <ul className="divide-y">
              {contact.suppliedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2">
                  <Link href={`/inventory/${item.id}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <Badge variant="outline">{item.sku}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value || "—"}</p>
    </div>
  );
}
