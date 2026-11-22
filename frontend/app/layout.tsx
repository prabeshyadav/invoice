import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "InvoicePro — Customer & Invoice Management",
  description: "A modern invoicing platform to manage customers, items, and invoices with ease.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
