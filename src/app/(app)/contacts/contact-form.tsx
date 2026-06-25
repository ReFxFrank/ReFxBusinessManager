"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { contactSchema, type ContactFormValues } from "@/lib/validation";
import { createContact, updateContact, type ActionState } from "./actions";
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

interface ContactLike {
  id: string;
  name: string;
  type: "customer" | "supplier" | "both";
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

const TYPES: { value: "customer" | "supplier" | "both"; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "both", label: "Both" },
];

export function ContactFormDialog({
  contact,
  trigger,
}: {
  contact?: ContactLike;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(contact);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: contact?.name ?? "",
      type: contact?.type ?? "customer",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      address: contact?.address ?? "",
      notes: contact?.notes ?? "",
    },
  });

  function onSubmit(values: ContactFormValues) {
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    startTransition(async () => {
      const action = editing ? updateContact.bind(null, contact!.id) : createContact;
      const res: ActionState = await action({ ok: false }, fd);
      if (res.ok) {
        toast({ title: editing ? "Contact updated" : "Contact created", variant: "success" });
        setOpen(false);
        form.reset(values);
        router.refresh();
      } else {
        if (res.fieldErrors) {
          for (const [k, msg] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof ContactFormValues, { message: msg });
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
            {editing ? "Edit" : "New contact"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} placeholder="e.g. Acme Co." />
          </Field>
          <Field label="Type" error={form.formState.errors.type?.message}>
            <Select
              defaultValue={form.getValues("type")}
              onValueChange={(v) =>
                form.setValue("type", v as "customer" | "supplier" | "both")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register("email")} placeholder="name@example.com" />
            </Field>
            <Field label="Phone" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} placeholder="(555) 123-4567" />
            </Field>
          </div>
          <Field label="Address" error={form.formState.errors.address?.message}>
            <Input {...form.register("address")} placeholder="123 Main St" />
          </Field>
          <Field label="Notes" error={form.formState.errors.notes?.message}>
            <Textarea {...form.register("notes")} rows={2} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
