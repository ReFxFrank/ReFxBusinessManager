"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteContact } from "./actions";
import { ContactFormDialog } from "./contact-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ContactRow {
  id: string;
  name: string;
  type: "customer" | "supplier" | "both";
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

export function ContactRowActions({ contact }: { contact: ContactRow }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function onDelete() {
    if (!confirm("Delete this contact? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteContact(contact.id);
        toast({ title: "Contact deleted", variant: "success" });
        router.refresh();
      } catch {
        toast({ title: "Could not delete contact", variant: "destructive" });
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
        <ContactFormDialog
          contact={contact}
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
