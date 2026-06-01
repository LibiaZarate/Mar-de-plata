import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mar de Plata · Taxco Workspace",
  description: "Dashboard operativo de Mar de Plata Taxco — joyería de plata 925.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
