"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validation";

export type ActionState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodToState(error: import("zod").ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}

export async function createContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  await prisma.contact.create({
    data: {
      name: v.name,
      type: v.type,
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      notes: v.notes || null,
    },
  });

  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateContact(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  await prisma.contact.update({
    where: { id },
    data: {
      name: v.name,
      type: v.type,
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      notes: v.notes || null,
    },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { ok: true };
}

export async function deleteContact(id: string): Promise<void> {
  // FK relations are onDelete: SetNull, so deleting a contact is safe.
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
  redirect("/contacts");
}
