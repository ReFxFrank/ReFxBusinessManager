"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setSaleStatus } from "../actions";

export function SaleActionsBar({ saleId, status }: { saleId: string; status: "paid" | "unpaid" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print invoice
      </Button>
      <Button
        variant={status === "paid" ? "outline" : "success"}
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setSaleStatus(saleId, status === "paid" ? "unpaid" : "paid");
            toast({ title: status === "paid" ? "Marked unpaid" : "Marked paid", variant: "success" });
            router.refresh();
          })
        }
      >
        {status === "paid" ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {status === "paid" ? "Mark unpaid" : "Mark paid"}
      </Button>
    </div>
  );
}
