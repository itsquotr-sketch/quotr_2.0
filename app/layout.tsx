import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {
  QUOTR_ICON_SRC,
  QUOTR_PRODUCT_LINE,
} from "@/lib/branding/assets";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quotr",
  description: QUOTR_PRODUCT_LINE,
  icons: {
    icon: [{ url: QUOTR_ICON_SRC, type: "image/png" }],
    apple: QUOTR_ICON_SRC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-dvh font-sans md:h-dvh md:overflow-hidden print:h-auto print:overflow-visible">
        {children}
      </body>
    </html>
  );
}
