import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAFER Hipismo | 5y6 La Rinconada",
  description: "Tu 5y6 de La Rinconada, con jugadas organizadas y resultados transparentes.",
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
