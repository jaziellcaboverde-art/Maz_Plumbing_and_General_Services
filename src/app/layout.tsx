import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { DEFAULT_FONT_SIZE, fontSizeInitScript } from "@/lib/font-size";
import "./globals.css";

const sans = Atkinson_Hyperlegible_Next({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Capstone",
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
      </head>
      <body>{children}</body>
    </html>
  );
}
