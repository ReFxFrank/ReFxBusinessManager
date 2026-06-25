import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, StatCard } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactFormDialog } from "./contact-form";
import { ContactRowActions } from "./row-actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type ?? "";

  const where: Prisma.ContactWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    ...(type === "customer" || type === "supplier" || type === "both" ? { type } : {}),
  };

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { sales: true, purchases: true } } },
  });

  const customerCount = contacts.filter((c) => c.type === "customer" || c.type === "both").length;
  const supplierCount = contacts.filter((c) => c.type === "supplier" || c.type === "both").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contacts`}
        action={<ContactFormDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Customers" value={String(customerCount)} />
        <StatCard label="Suppliers" value={String(supplierCount)} />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q} placeholder="Search name or email…" className="max-w-xs" />
        <select
          name="type"
          defaultValue={type}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          <option value="customer">Customers</option>
          <option value="supplier">Suppliers</option>
          <option value="both">Both</option>
        </select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q || type ? "No contacts match your filters" : "No contacts yet"}
          description="Add your first customer or supplier to get started."
          action={<ContactFormDialog />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{contact.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{contact.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.phone ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{contact._count.sales}</TableCell>
                  <TableCell className="text-right tabular-nums">{contact._count.purchases}</TableCell>
                  <TableCell className="text-right">
                    <ContactRowActions
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
