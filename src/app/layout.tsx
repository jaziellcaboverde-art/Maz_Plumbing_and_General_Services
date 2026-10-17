import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

const sans = Atkinson_Hyperlegible_Next({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Capstone",
  description: "Book trusted home services near you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
