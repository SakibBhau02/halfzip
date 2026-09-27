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

  // Seed the single product with the 5 colors × 4 sizes if none exists
  const existing = await prisma.product.findFirst();
  if (!existing) {
    const colors = [
      { color: "Black", colorHex: "#161616", slug: "black" },
      { color: "Maroon", colorHex: "#6d1f2c", slug: "maroon" },
      { color: "Green", colorHex: "#274d3a", slug: "green" },
      { color: "Navy Blue", colorHex: "#1e2a48", slug: "navyblue" },
      { color: "Off-White", colorHex: "#e9e3d7", slug: "offwhite" },
    ];
    const sizes = ["M", "L", "XL", "XXL"];
    const price = 88000; // ৳880

    const product = await prisma.product.create({
      data: {
        name: "Half Zipper Sweatshirt",
        slug: "half-zipper-sweatshirt",
        tagline: "Premium Winter Wear",
        description:
          "নরম ফ্লিস, ডাবল স্টিচিং আর পারফেক্ট ফিট — শীতে আরাম আর স্টাইল একসাথে।",
        basePrice: price,
        oldPrice: 129000,
        insideFee: 6000,
        outsideFee: 12000,
        images: {
          create: colors.map((c, i) => ({
            url: `/images/${c.slug}.webp`,
            alt: `${c.color} Half Zipper Sweatshirt`,
            color: c.color,
            sortOrder: i,
          })),
        },
        variants: {
          create: colors.flatMap((c) =>
            sizes.map((s) => ({
              color: c.color,
              colorHex: c.colorHex,
              size: s,
              sku: `${c.slug.toUpperCase()}-${s}`,
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

  // Demo supplier cost price for the product (৳600/pc reseller rate)
  const prod = await prisma.product.findFirst();
  if (prod && supplier) {
    await prisma.supplierProductCost.upsert({
      where: {
        supplierId_productId: { supplierId: supplier.id, productId: prod.id },
      },
      update: { costPrice: 60000 },
      create: { supplierId: supplier.id, productId: prod.id, costPrice: 60000 },
    });
    console.log("✔ Supplier cost price set: ৳600/pc");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
