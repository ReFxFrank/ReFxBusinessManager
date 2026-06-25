import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "ReFx Business Manager",
  description: "Inventory, profit & margin, media gallery, and social publishing for small inventory sellers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
