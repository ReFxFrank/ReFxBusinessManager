import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { config } from "@/lib/config";
import { isAuthenticated } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  if (!config.auth.enabled) redirect("/");
  if (await isAuthenticated()) redirect("/");
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-6 w-6" />
          </div>
          <CardTitle>ReFx Business Manager</CardTitle>
          <CardDescription>Sign in to manage inventory, sales & profit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/auth/login" method="post" className="space-y-4">
            <input type="hidden" name="from" value={sp.from ?? "/"} />
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoFocus placeholder="Enter password" />
            </div>
            {sp.error && <p className="text-sm text-destructive">Incorrect password. Try again.</p>}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Demo password: <code className="rounded bg-muted px-1">{config.auth.password}</code>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
