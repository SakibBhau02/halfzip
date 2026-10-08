import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@halfzipper.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN" },
    create: { email, name: "Admin", passwordHash, role: "ADMIN" },
  });
  console.log(`✔ Admin ready: ${user.email}  (password: ${password})`);

  // Seed a demo supplier + supplier login
  const supEmail = "supplier@halfzipper.local";
  const supPass = "supplier123";
  const supHash = await bcrypt.hash(supPass, 12);
  let supplier = await prisma.supplier.findFirst({
    where: { email: supEmail },
  });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: "Demo Supplier",
        company: "Demo Textiles Ltd",
        phone: "01700000000",
        email: supEmail,
        address: "Islampur, Dhaka",
      },
    });
  }
  await prisma.user.upsert({
    where: { email: supEmail },
    update: { passwordHash: supHash, role: "SUPPLIER", supplierId: supplier.id },
    create: {
      email: supEmail,
      name: supplier.name,
      passwordHash: supHash,
      role: "SUPPLIER",
      supplierId: supplier.id,
    },
  });
  console.log(`✔ Supplier ready: ${supEmail}  (password: ${supPass})`);

  // Seed the single product (Hooded Puffer Jacket, 5 colors × 4 sizes) if none exists.
  // Images are uploaded afterwards via Admin → Products → Images (per-color).
  const existing = await prisma.product.findFirst();
  if (!existing) {
    const colors = [
      { color: "Blue", colorHex: "#2a3d66", slug: "blue" },
      { color: "Black", colorHex: "#161616", slug: "black" },
      { color: "Army Green", colorHex: "#4b5320", slug: "armygreen" },
      { color: "Khaki", colorHex: "#c3b091", slug: "khaki" },
      { color: "Burgundy", colorHex: "#6d1f2c", slug: "burgundy" },
    ];
    const sizes = ["M", "L", "XL", "XXL"];
    const price = 160000; // ৳1600

    const product = await prisma.product.create({
      data: {
        name: "Hooded Puffer Jacket",
        slug: "hooded-puffer-jacket",
        tagline: "Premium Winter Jacket",
        description:
          "হালকা ওজনের প্রিমিয়াম পাফার জ্যাকেট — হুডসহ, ভেতরে উষ্ণ ফিল, শীতের জন্য পারফেক্ট।",
        basePrice: price,
        oldPrice: 199000,
        combo2Price: 320000,
        combo3Price: 480000,
        freeDeliveryAt: 2,
        insideFee: 6000,
        outsideFee: 12000,
        variants: {
          create: colors.flatMap((c) =>
            sizes.map((s) => ({
              color: c.color,
              colorHex: c.colorHex,
              size: s,
              sku: `JACKET-${c.slug.toUpperCase()}-${s}`,
              price,
              stock: 10,
            }))
          ),
        },
      },
    });
    console.log(`✔ Product seeded: ${product.name} (20 variants)`);
  } else {
    console.log("ℹ Product already exists — skipping seed");
  }

  // Demo supplier cost price for the product (৳950/pc reseller rate)
  const prod = await prisma.product.findFirst();
  if (prod && supplier) {
    await prisma.supplierProductCost.upsert({
      where: {
        supplierId_productId: { supplierId: supplier.id, productId: prod.id },
      },
      update: { costPrice: 95000 },
      create: { supplierId: supplier.id, productId: prod.id, costPrice: 95000 },
    });
    console.log("✔ Supplier cost price set: ৳950/pc");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
