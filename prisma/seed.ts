/**
 * Seed script — realistic sample data so profit reports are populated and the
 * app is usable immediately.
 *
 *  * Contacts (customers + suppliers)
 *  * Items across a few categories
 *  * Product images generated with `sharp` (no external downloads), with a
 *    primary image set per item
 *  * Purchases over the last ~90 days → drive moving-average cost
 *  * Sales over the last ~90 days → snapshot COGS + realized profit
 *  * Expenses + other income, manual price change, and a couple of documents
 *
 * Run with: npm run seed   (wraps `tsx prisma/seed.ts`)
 *
 * Note: sample MEDIA is images only — generating a real video file requires
 * ffmpeg, which is an optional system dependency. Upload a video via the item
 * gallery to exercise the video path. See the README.
 */

import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { recordPurchase, recordSale } from "../src/lib/inventory";
import { processImage } from "../src/lib/media";
import { storage } from "../src/lib/storage";

const prisma = new PrismaClient();

// Deterministic-ish PRNG so seeds are reproducible.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

const PALETTE = [
  ["#2563eb", "#1e40af"],
  ["#16a34a", "#15803d"],
  ["#db2777", "#9d174d"],
  ["#ea580c", "#c2410c"],
  ["#7c3aed", "#5b21b6"],
  ["#0891b2", "#155e75"],
  ["#ca8a04", "#854d0e"],
];

async function makeImageBuffer(label: string, idx: number): Promise<Buffer> {
  const [c1, c2] = PALETTE[idx % PALETTE.length];
  const svg = `
    <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#g)"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="64" font-weight="bold"
            fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text>
      <text x="50%" y="62%" font-family="Arial, sans-serif" font-size="28"
            fill="rgba(255,255,255,0.8)" text-anchor="middle">ReFx sample image</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function attachImages(itemId: string, name: string, count: number, startIdx: number) {
  let firstId: string | null = null;
  for (let i = 0; i < count; i++) {
    const media = await prisma.media.create({
      data: { itemId, type: "image", filePath: "", mimeType: "image/png", fileSize: 0, sortOrder: i },
    });
    const buf = await makeImageBuffer(`${name} #${i + 1}`, startIdx + i);
    const processed = await processImage(media.id, buf, "image/png", `${name}.png`);
    await prisma.media.update({
      where: { id: media.id },
      data: {
        filePath: processed.filePath,
        webPath: processed.webPath,
        thumbnailPath: processed.thumbnailPath,
        width: processed.width,
        height: processed.height,
        fileSize: processed.fileSize,
        alt: `${name} product photo ${i + 1}`,
        caption: i === 0 ? `${name} — primary` : null,
      },
    });
    if (i === 0) firstId = media.id;
  }
  if (firstId) await prisma.item.update({ where: { id: itemId }, data: { primaryMediaId: firstId } });
}

async function main() {
  console.log("Resetting database…");
  // Order matters for FK constraints.
  await prisma.socialPost.deleteMany();
  await prisma.socialConnection.deleteMany();
  await prisma.document.deleteMany();
  await prisma.priceLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.saleLine.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseLine.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.expense.deleteMany();
  // Null out primary media before deleting media/items.
  await prisma.item.updateMany({ data: { primaryMediaId: null } });
  await prisma.media.deleteMany();
  await prisma.item.deleteMany();
  await prisma.contact.deleteMany();

  console.log("Creating contacts…");
  const suppliers = await Promise.all(
    [
      { name: "Northwind Wholesale", email: "orders@northwind.example", phone: "555-0101" },
      { name: "Clayworks Supply Co.", email: "sales@clayworks.example", phone: "555-0144" },
      { name: "BeanRiver Importers", email: "hello@beanriver.example", phone: "555-0190" },
    ].map((s) => prisma.contact.create({ data: { ...s, type: "supplier" } })),
  );

  const customers = await Promise.all(
    [
      { name: "Cafe Lumiere", email: "buy@lumiere.example", phone: "555-0202" },
      { name: "The Corner Market", email: "ap@cornermarket.example", phone: "555-0211" },
      { name: "Jane Doe", email: "jane@example.com", phone: "555-0233" },
      { name: "Riverside Gifts", email: "shop@riverside.example", phone: "555-0247" },
      { name: "Walk-in Customer" },
    ].map((c) => prisma.contact.create({ data: { ...c, type: "customer" } })),
  );

  console.log("Creating items + product images…");
  const itemDefs = [
    { name: "Blue Ceramic Mug", category: "Drinkware", unit: "each", sale: 1499, supplier: 1, reorder: 12, imgs: 3 },
    { name: "Stainless Travel Tumbler", category: "Drinkware", unit: "each", sale: 2499, supplier: 0, reorder: 8, imgs: 2 },
    { name: "House Blend Coffee Beans", category: "Coffee", unit: "kg", sale: 3200, supplier: 2, reorder: 5, imgs: 2 },
    { name: "Single-Origin Ethiopia", category: "Coffee", unit: "kg", sale: 4500, supplier: 2, reorder: 4, imgs: 2 },
    { name: "Pour-Over Dripper", category: "Equipment", unit: "each", sale: 1899, supplier: 1, reorder: 6, imgs: 2 },
    { name: "Gooseneck Kettle", category: "Equipment", unit: "each", sale: 5499, supplier: 0, reorder: 3, imgs: 3 },
    { name: "Linen Tea Towel", category: "Textiles", unit: "each", sale: 899, supplier: 1, reorder: 20, imgs: 1 },
    { name: "Bamboo Coaster Set", category: "Tableware", unit: "pack", sale: 1299, supplier: 1, reorder: 10, imgs: 2 },
    { name: "Glass Storage Jar", category: "Tableware", unit: "each", sale: 999, supplier: 0, reorder: 15, imgs: 1 },
    { name: "Cold Brew Bottle", category: "Drinkware", unit: "each", sale: 1799, supplier: 0, reorder: 7, imgs: 2 },
  ];

  let imgCursor = 0;
  const items = [] as { id: string; sale: number; cost: number }[];
  for (let i = 0; i < itemDefs.length; i++) {
    const d = itemDefs[i];
    const sku = `${d.category.slice(0, 3).toUpperCase()}-${1000 + i}`;
    const cost = Math.round(d.sale * (0.45 + rand() * 0.2)); // ~45-65% of sale
    const item = await prisma.item.create({
      data: {
        name: d.name,
        sku,
        category: d.category,
        unit: d.unit,
        salePrice: d.sale,
        reorderThreshold: d.reorder,
        supplierId: suppliers[d.supplier].id,
        notes: `Sample ${d.category.toLowerCase()} item.`,
      },
    });
    await attachImages(item.id, d.name, d.imgs, imgCursor);
    imgCursor += d.imgs;
    items.push({ id: item.id, sale: d.sale, cost });
  }

  console.log("Recording purchases (moving-average cost)…");
  // Initial stocking purchases + periodic restocks.
  for (let day = 90; day >= 5; day -= randInt(7, 14)) {
    const lineCount = randInt(2, 4);
    const chosen = new Set<number>();
    const lines = [];
    for (let l = 0; l < lineCount; l++) {
      let idx = randInt(0, items.length - 1);
      while (chosen.has(idx)) idx = randInt(0, items.length - 1);
      chosen.add(idx);
      const it = items[idx];
      // Cost drifts slightly over time to make moving-average meaningful.
      const drift = 1 + (rand() - 0.5) * 0.2;
      lines.push({ itemId: it.id, qty: randInt(40, 100), unitCost: Math.round(it.cost * drift) });
    }
    await recordPurchase({
      contactId: pick(suppliers).id,
      date: daysAgo(day),
      status: rand() > 0.15 ? "paid" : "unpaid",
      lines,
      notes: "Restock order",
    });
  }

  console.log("Recording sales (COGS snapshot + realized profit)…");
  const paymentMethods = ["cash", "card", "transfer"];
  for (let day = 85; day >= 0; day -= 1) {
    // Most days have sales.
    if (rand() > 0.82) continue;
    const saleCount = randInt(1, 4);
    for (let s = 0; s < saleCount; s++) {
      const lineCount = randInt(1, 3);
      const lines = [];
      const chosen = new Set<number>();
      for (let l = 0; l < lineCount; l++) {
        let idx = randInt(0, items.length - 1);
        while (chosen.has(idx)) idx = randInt(0, items.length - 1);
        chosen.add(idx);
        const it = items[idx];
        const current = await prisma.item.findUnique({ where: { id: it.id } });
        if (!current || current.quantity < 1) continue;
        const qty = Math.min(current.quantity, randInt(1, 5));
        // Occasionally apply a small discount to vary margins.
        const price = rand() > 0.85 ? Math.round(it.sale * 0.9) : it.sale;
        lines.push({ itemId: it.id, qty, unitSalePrice: price });
      }
      if (lines.length === 0) continue;
      try {
        await recordSale({
          contactId: pick(customers).id,
          date: daysAgo(day),
          status: rand() > 0.12 ? "paid" : "unpaid",
          paymentMethod: pick(paymentMethods),
          lines,
          allowOversell: false,
        });
      } catch {
        // skip oversell edge cases in seed
      }
    }
  }

  console.log("Recording expenses + other income…");
  const expenseCats = [
    { category: "Rent", amount: 60000 },
    { category: "Wages", amount: 70000 },
    { category: "Utilities", amount: 12000 },
    { category: "Packaging", amount: 6500 },
    { category: "Marketing", amount: 9000 },
    { category: "Platform fees", amount: 4200 },
  ];
  for (let month = 2; month >= 0; month--) {
    for (const e of expenseCats) {
      await prisma.expense.create({
        data: {
          date: daysAgo(month * 30 + randInt(0, 5)),
          category: e.category,
          amount: Math.round(e.amount * (0.9 + rand() * 0.2)),
          kind: "expense",
          status: month === 0 && rand() > 0.6 ? "unpaid" : "paid",
        },
      });
    }
  }
  await prisma.expense.create({
    data: { date: daysAgo(20), category: "Interest", amount: 3400, kind: "income", note: "Savings interest" },
  });

  console.log("Logging a manual sale-price change…");
  const bumpItem = items[0];
  await prisma.$transaction(async (tx) => {
    const it = await tx.item.findUniqueOrThrow({ where: { id: bumpItem.id } });
    const newPrice = it.salePrice + 100;
    await tx.priceLog.create({
      data: { itemId: it.id, field: "sale", oldPrice: it.salePrice, newPrice, note: "Seasonal price increase" },
    });
    await tx.item.update({ where: { id: it.id }, data: { salePrice: newPrice } });
  });

  console.log("Creating sample documents…");
  const receiptBuf = await makeImageBuffer("RECEIPT", 3);
  const receiptKey = "documents/sample-receipt.png";
  await storage.put(receiptKey, receiptBuf);
  await prisma.document.create({
    data: {
      title: "Northwind invoice — March restock",
      type: "invoice",
      filePath: receiptKey,
      mimeType: "image/png",
      fileSize: receiptBuf.length,
      contactId: suppliers[0].id,
      notes: "Sample invoice document.",
    },
  });
  const contractBuf = Buffer.from(
    "SUPPLY AGREEMENT\n\nThis is a sample contract document seeded by ReFx Business Manager.\n",
    "utf8",
  );
  const contractKey = "documents/sample-contract.txt";
  await storage.put(contractKey, contractBuf);
  await prisma.document.create({
    data: {
      title: "Clayworks supply agreement",
      type: "contract",
      filePath: contractKey,
      mimeType: "text/plain",
      fileSize: contractBuf.length,
      contactId: suppliers[1].id,
    },
  });

  const counts = {
    items: await prisma.item.count(),
    media: await prisma.media.count(),
    sales: await prisma.sale.count(),
    purchases: await prisma.purchase.count(),
    expenses: await prisma.expense.count(),
    contacts: await prisma.contact.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
