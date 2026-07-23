import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sms/sw-register";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PointerCaptureFix } from "@/components/ui/pointer-capture-fix";

export const metadata: Metadata = {
  title: "Aegis — SMS Finance Tracker for India",
  description:
    "Aegis is an offline-first personal finance tracker for India. Parses bank/UPI/NBFC SMS, speaks transactions aloud in your language, tracks loans & EMIs, and flags scam messages — all on-device.",
  keywords: [
    "Aegis",
    "SMS finance tracker",
    "India banking",
    "UPI",
    "EMI tracker",
    "scam detection",
    "offline finance",
    "Hindi voice",
  ],
  authors: [{ name: "Aegis" }],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <PointerCaptureFix />
        <ErrorBoundary>
          {children}
          <ServiceWorkerRegister />
          <Toaster />
          <SonnerToaster richColors position="top-center" />
        </ErrorBoundary>
      </body>
    </html>
  );
}
