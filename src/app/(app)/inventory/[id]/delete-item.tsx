"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteItem } from "../actions";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const [pending, start] = React.useTransition();
  const { toast } = useToast();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={pending}
      title="Delete item"
      onClick={() => {
        if (!confirm("Delete this item? Items with sales/purchase history can't be deleted.")) return;
        start(async () => {
          try {
            await deleteItem(itemId);
          } catch (e) {
            toast({
              title: e instanceof Error ? e.message : "Could not delete item",
              variant: "destructive",
            });
          }
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
