import type { Metadata } from "next";
import { Poppins, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font — no render-blocking Google Fonts request (LCP win)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hooded Puffer Jacket — Premium Winter Wear in Bangladesh",
  description:
    "Premium hooded puffer jacket with warm inner fill. Cash on Delivery all over Bangladesh. Order now.",
  keywords: [
    "hooded puffer jacket",
    "puffer jacket bd",
    "winter jacket price in bd",
    "cash on delivery jacket",
    "premium winter wear bangladesh",
  ],
  openGraph: {
    title: "Hooded Puffer Jacket — Premium Winter Wear",
    description:
      "Lightweight premium puffer jacket with hood. Cash on Delivery all over Bangladesh.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${notoBengali.variable}`}>
      <body>{children}</body>
    </html>
  );
}
