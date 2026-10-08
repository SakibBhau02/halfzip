// ---------------------------------------------------------------------------
//  EDIT EVERYTHING HERE — all product info lives in this one file.
// ---------------------------------------------------------------------------

export const site = {
  brand: "Manza BD",
  tagline: "Premium Winter Jacket",
  productName: "Hooded Puffer Jacket",

  price: 880, // in BDT (৳)
  oldPrice: 1290, // strike-through price to show value

  // Contact — CHANGE THESE to your real numbers
  phone: "01XXXXXXXXX", // displayed & tel: link
  whatsapp: "8801XXXXXXXXX", // international format, digits only
  messenger: "yourpage", // facebook page username for m.me link

  delivery: {
    inside: 60, // Dhaka inside
    outside: 120, // Dhaka outside
  },
};

export const sizes = ["M", "L", "XL", "XXL"] as const;
export type Size = (typeof sizes)[number];

export const colors = [
  { name: "Black", image: "/images/black.webp", swatch: "#161616" },
  { name: "Maroon", image: "/images/maroon.webp", swatch: "#6d1f2c" },
  { name: "Green", image: "/images/green.webp", swatch: "#274d3a" },
  { name: "Navy Blue", image: "/images/navyblue.webp", swatch: "#1e2a48" },
  { name: "Off-White", image: "/images/offwhite.webp", swatch: "#e9e3d7" },
] as const;

export const wishlist = [
  "Cash on Delivery — পণ্য হাতে পেয়ে টাকা দিবেন",
  "সারা বাংলাদেশে হোম ডেলিভারি",
  "প্রিমিয়াম কোয়ালিটি ফ্যাব্রিক",
  "পণ্য পছন্দ না হলে রিটার্ন / এক্সচেঞ্জ সুবিধা",
];

export const qualityPoints = [
  {
    title: "ফ্লিস লাইনিং",
    body: "ভিতরে নরম ফ্লিস লাইনিং — শীতের সকালে আরামদায়ক উষ্ণতা।",
    icon: "snow",
  },
  {
    title: "ডাবল স्टिचिंग",
    body: "কাঁধ ও কলারে ডাবল স্টিচিং — বারবার ধোলার পরেও টিকে থাকে।",
    icon: "stitch",
  },
  {
    title: "হাই-কোয়ালিটি ইয়ার্ন",
    body: "রঙ ধোঁয়া যায় না, গিঁট পড়ে না — ফ্যাশন稳固 season after season।",
    icon: "yarn",
  },
  {
    title: "ব্রিদেবল সাইজ",
    body: "M, L, XL, XXL — সঠিক মাপে শরীরে ফিট হয়।",
    icon: "ruler",
  },
];

export const fabricSpecs = [
  { label: "ফ্যাব্রিক", value: "Premium Cotton Blend Fleece" },
  { label: "ইনসুলেশন", value: "Soft Brushed Inner Fleece" },
  { label: "জিপার", value: "Heavy-duty Metal Zipper" },
  { label: "কলার", value: "Stand Collar / Mock Neck" },
  { label: "সিজন", value: "Winter / Late Autumn" },
  { label: "মেজারমেন্ট", value: "M / L / XL / XXL" },
];

/**
 * Canonical site URL for server-side use (callbacks, event_source_url…).
 * Priority: explicit NEXTAUTH_URL → Vercel deployment URL → local dev.
 */
export function getSiteUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3100";
}
