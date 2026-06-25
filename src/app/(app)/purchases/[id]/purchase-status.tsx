"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setPurchaseStatus } from "../actions";

export function PurchaseStatusToggle({ purchaseId, status }: { purchaseId: string; status: "paid" | "unpaid" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant={status === "paid" ? "outline" : "success"}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setPurchaseStatus(purchaseId, status === "paid" ? "unpaid" : "paid");
          toast({ title: status === "paid" ? "Marked unpaid" : "Marked paid", variant: "success" });
          router.refresh();
        })
      }
    >
      {status === "paid" ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      {status === "paid" ? "Mark unpaid" : "Mark paid"}
    </Button>
  );
}
