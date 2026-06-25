"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { disconnect } from "./actions";

export function DisconnectButton({ provider, label }: { provider: string; label: string }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function onClick() {
    if (!confirm(`Disconnect ${label}? You can reconnect at any time.`)) return;
    startTransition(async () => {
      await disconnect(provider);
      toast({ title: `${label} disconnected`, variant: "success" });
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
