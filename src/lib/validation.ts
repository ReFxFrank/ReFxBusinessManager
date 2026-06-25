import { z } from "zod";

/** A money field accepted as a string (UI) and parsed to cents elsewhere. */
const moneyString = z
  .string()
  .min(1, "Required")
  .refine((v) => /^-?\$?\s*[\d,]*\.?\d{0,2}$/.test(v.trim()), "Enter a valid amount");

const qtyNumber = z.coerce.number().positive("Must be greater than 0");

export const itemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().max(60).optional().or(z.literal("")),
  category: z.string().max(80).optional().or(z.literal("")),
  unit: z.string().min(1).max(20).default("each"),
  salePrice: moneyString,
  avgCost: moneyString.optional().or(z.literal("")),
  quantity: z.coerce.number().min(0).default(0),
  reorderThreshold: z.coerce.number().min(0).default(0),
  supplierId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type ItemFormValues = z.infer<typeof itemSchema>;

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["customer", "supplier", "both"]).default("customer"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  address: z.string().max(400).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type ContactFormValues = z.infer<typeof contactSchema>;

export const saleLineSchema = z.object({
  itemId: z.string().min(1, "Pick an item"),
  qty: qtyNumber,
  unitSalePrice: moneyString,
});

export const saleSchema = z.object({
  contactId: z.string().optional().or(z.literal("")),
  date: z.string().min(1),
  status: z.enum(["paid", "unpaid"]).default("paid"),
  paymentMethod: z.string().max(40).default("cash"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  allowOversell: z.boolean().default(false),
  lines: z.array(saleLineSchema).min(1, "Add at least one line item"),
});
export type SaleFormValues = z.infer<typeof saleSchema>;

export const purchaseLineSchema = z.object({
  itemId: z.string().min(1, "Pick an item"),
  qty: qtyNumber,
  unitCost: moneyString,
});

export const purchaseSchema = z.object({
  contactId: z.string().optional().or(z.literal("")),
  date: z.string().min(1),
  status: z.enum(["paid", "unpaid"]).default("paid"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  lines: z.array(purchaseLineSchema).min(1, "Add at least one line item"),
});
export type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export const expenseSchema = z.object({
  date: z.string().min(1),
  category: z.string().min(1, "Category is required").max(80),
  amount: moneyString,
  kind: z.enum(["expense", "income"]).default("expense"),
  note: z.string().max(2000).optional().or(z.literal("")),
  status: z.enum(["paid", "unpaid"]).default("paid"),
});
export type ExpenseFormValues = z.infer<typeof expenseSchema>;

export const adjustStockSchema = z.object({
  change: z.coerce.number().refine((v) => v !== 0, "Change can't be zero"),
  reason: z.string().min(1, "Reason is required").max(200),
});

export const documentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  type: z.enum(["invoice", "receipt", "contract", "other"]).default("other"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  contactId: z.string().optional().or(z.literal("")),
  itemId: z.string().optional().or(z.literal("")),
  saleId: z.string().optional().or(z.literal("")),
  purchaseId: z.string().optional().or(z.literal("")),
});
