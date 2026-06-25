import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
