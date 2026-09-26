import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Half Zipper Sweatshirt — Premium Winter Wear in Bangladesh",
  description:
    "Premium quality Half Zipper Sweatshirt. Soft fleece, durable fabric, perfect for winter. Cash on Delivery all over Bangladesh. Order now.",
  keywords: [
    "half zipper sweatshirt",
    "winter sweatshirt bd",
    "half zipper price in bd",
    "cash on delivery sweatshirt",
    "premium winter wear bangladesh",
  ],
  openGraph: {
    title: "Half Zipper Sweatshirt — Premium Winter Wear",
    description:
      "Soft fleece, durable stitching, perfect winter fit. Cash on Delivery all over Bangladesh.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Noto+Sans+Bengali:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
