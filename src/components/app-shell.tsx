"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Home,
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  AtSign,
  Wallet,
  Menu,
  Bell,
  X,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Package,
  Images,
  Users,
  FileText,
  Share2,
  Banknote,
  Plug,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p.startsWith("/dashboard") },
  { href: "/inventory", label: "Inventory", icon: Boxes, match: (p: string) => p.startsWith("/inventory") },
  { href: "/products", label: "Products", icon: ShoppingBag, match: (p: string) => p.startsWith("/products") },
  { href: "/socials", label: "Socials", icon: AtSign, match: (p: string) => p.startsWith("/socials") || p.startsWith("/settings") },
  { href: "/finances", label: "Finances", icon: Wallet, match: (p: string) => ["/finances", "/sales", "/purchases", "/expenses", "/reports"].some((x) => p.startsWith(x)) },
] as const;

const DRAWER_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/products", label: "Products", icon: ShoppingBag },
  { href: "/sales", label: "Sales & Invoices", icon: ShoppingCart },
  { href: "/purchases", label: "Purchases", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/finances", label: "Finances", icon: Banknote },
  { href: "/reports", label: "Profit & Reports", icon: TrendingUp },
  { href: "/socials", label: "Socials", icon: AtSign },
  { href: "/integrations", label: "Shopify / Etsy", icon: Plug },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings/connections", label: "Connections", icon: Share2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-background">
      {/* Top app bar */}
      <header className="app-chrome sticky top-0 z-30 border-b bg-background/85 pt-safe backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-bold tracking-tight">ReFx</span>
          </Link>
          <Link
            href="/socials"
            aria-label="Notifications"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 hover:bg-accent"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-5 pb-tabbar">{children}</main>

      {/* Bottom tab bar (6 tabs) */}
      <nav className="app-chrome fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t bg-background/95 pb-safe backdrop-blur-md">
        <div className="grid grid-cols-6 px-1 pt-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.match(pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[9.5px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active && "stroke-[2.4]")} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Slide-over drawer (full navigation) */}
      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} pathname={pathname} />
    </div>
  );
}

function NavDrawer({
  open,
  onOpenChange,
  pathname,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pathname: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col border-r bg-card pt-safe shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <Dialog.Title className="text-sm font-bold">ReFx Manager</Dialog.Title>
                <p className="text-[10px] text-muted-foreground">Inventory · Profit · Media</p>
              </div>
            </div>
            <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {DRAWER_LINKS.map((l) => {
              const Icon = l.icon;
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
          </div>
          <div className="border-t p-2 pb-safe">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
