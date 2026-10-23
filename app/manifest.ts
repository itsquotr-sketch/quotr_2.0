import type { MetadataRoute } from "next";
import { QUOTR_PRODUCT_LINE } from "@/lib/branding/assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quotr",
    short_name: "Quotr",
    description: QUOTR_PRODUCT_LINE,
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/branding/quotr-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/quotr-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
