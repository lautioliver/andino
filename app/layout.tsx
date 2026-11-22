import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AppShell } from "@/shared/ui/AppShell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ANDINO — Explorá la Tierra. Descubrí el universo.",
  description: "Jujuy, de la Tierra al universo: paisajes con fuentes y el cielo calculado para el mismo lugar.",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
