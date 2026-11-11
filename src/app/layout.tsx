import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

/**
 * Inter se declaraba en globals.css pero nunca se cargaba, así que la
 * plataforma venía renderizando en la fuente del sistema. Se expone como
 * variable CSS y la consume --font-sans en el @theme.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title:       "Ecocomal v3 | Sistema de Gestión Interno",
  description: "Plataforma de gestión operativa y administrativa para Ecocomal.",
  icons: { icon: "/brand/ecocomal.png", apple: "/brand/ecocomal.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${oswald.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
