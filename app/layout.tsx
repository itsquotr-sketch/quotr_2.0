import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PlaySurfaceProvider } from "@/components/android/PlaySurfaceProvider";
import { isPlaySurfaceRequest } from "@/lib/android/play-surface.server";
import {
  QUOTR_ICON_SRC,
  QUOTR_PRODUCT_LINE,
} from "@/lib/branding/assets";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Quotr",
  description: QUOTR_PRODUCT_LINE,
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: QUOTR_ICON_SRC, type: "image/png", sizes: "any" },
    ],
    apple: QUOTR_ICON_SRC,
    shortcut: QUOTR_ICON_SRC,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const playSurface = await isPlaySurfaceRequest();
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-dvh font-sans md:h-dvh md:overflow-hidden print:h-auto print:overflow-visible">
        <PlaySurfaceProvider enabled={playSurface}>
          <script
            id="early-nav-feedback"
            dangerouslySetInnerHTML={{
              __html:
                'document.addEventListener("click",function(event){if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;var node=event.target;if(!node||!node.closest)return;var link=node.closest("a[href]");if(!link||link.getAttribute("aria-current")==="page")return;var path=(link.getAttribute("href")||"").split("?")[0];if(path==="/app/contacts/subcontractors"){document.documentElement.setAttribute("data-contacts-nav","list");}else if(path.indexOf("/app/contacts/subcontractors/")===0){document.documentElement.setAttribute("data-contacts-nav","record");}else if(path==="/app/contacts"){document.documentElement.setAttribute("data-contacts-nav","customers");}else if(/^\\/app\\/projects\\/[^/]+\\/requests\\/new$/.test(path)){document.documentElement.setAttribute("data-rfq-nav","new");}},true);',
            }}
          />
          {children}
        </PlaySurfaceProvider>
      </body>
    </html>
  );
}
