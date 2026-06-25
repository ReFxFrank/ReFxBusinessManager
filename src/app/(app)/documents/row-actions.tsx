"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Download, Trash2 } from "lucide-react";
import { deleteDocument } from "./actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DocumentRowActions({ id, filePath }: { id: string; filePath: string }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function onDelete() {
    if (!confirm("Delete this document? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteDocument(id);
        toast({ title: "Document deleted", variant: "success" });
        router.refresh();
      } catch {
        toast({ title: "Could not delete document", variant: "destructive" });
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
        <DropdownMenuItem asChild>
          <a href={`/api/files/${encodeURI(filePath)}`} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" /> Open / Download
          </a>
        </DropdownMenuItem>
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
