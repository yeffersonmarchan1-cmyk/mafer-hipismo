import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAFER Hipismo | Cuadro Perfecto La Rinconada",
  description: "Tu Cuadro Perfecto de La Rinconada, con jugadas organizadas y resultados transparentes.",
  applicationName: "MAFER Hipismo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MAFER Hipismo",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#090a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Suspense fallback={<div className="min-h-screen animate-pulse bg-[#090a0f]" />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
