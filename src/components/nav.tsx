"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  TrendingUp,
  Images,
  Users,
  FileText,
  Share2,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/purchases", label: "Purchases", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Profit & Reports", icon: TrendingUp },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings/connections", label: "Connections", icon: Share2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(link.href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <Brand />
        <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {open && (
        <div className="border-b bg-background md:hidden">
          {nav}
          <LogoutButton />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex md:h-screen md:sticky md:top-0">
        <div className="px-5 py-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t p-3">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <TrendingUp className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">ReFx Manager</p>
        <p className="text-[10px] text-muted-foreground">Inventory · Profit · Media</p>
      </div>
    </Link>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
        Sign out
      </Button>
    </form>
  );
}
