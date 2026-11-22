import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { AppShell } from "@/shared/ui/AppShell";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "ANDINO — Tu mejor noche de cielo en Jujuy",
  description: "Cuándo salir, adónde mirar y qué estás viendo en el cielo de la Quebrada, calculado para el lugar donde estás.",
};

export const viewport: Viewport = {
  themeColor: "#fffaf7",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
