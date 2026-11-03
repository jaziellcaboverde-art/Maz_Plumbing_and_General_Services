import type { Metadata } from "next";
import localFont from "next/font/local";
import { DEFAULT_FONT_SIZE, fontSizeInitScript } from "@/lib/font-size";
import { appearanceInitScript } from "@/lib/appearance";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const sans = localFont({
  src: [
    {
      path: "./fonts/PublicSans-Variable.ttf",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/PublicSans-Italic-Variable.ttf",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  adjustFontFallback: false,
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "MAZ Plumbing and General Services",
  description: "Book trusted home services near you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={sans.variable}
      data-font-size={DEFAULT_FONT_SIZE}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontSizeInitScript() }} />
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
