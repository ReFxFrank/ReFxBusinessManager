"use client";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "destructive";

interface ToastItem {
  id: number;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const variantClasses: Record<ToastVariant, string> = {
  default: "border bg-background text-foreground",
  success: "border-success/40 bg-success text-success-foreground",
  destructive: "border-destructive/40 bg-destructive text-destructive-foreground",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && remove(item.id)}
            className={cn(
              "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-md p-4 pr-8 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-right-full",
              variantClasses[item.variant ?? "default"],
            )}
          >
            <div className="grid gap-1">
              {item.title && <ToastPrimitive.Title className="text-sm font-semibold">{item.title}</ToastPrimitive.Title>}
              {item.description && (
                <ToastPrimitive.Description className="text-sm opacity-90">{item.description}</ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-sm" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
