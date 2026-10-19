// Seeds staff roles, the VELMONT catalogue, store pages and FAQs.
// Safe to run more than once: existing rows are left alone.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as s from "../src/db/schema";
import { PRESET_ROLES } from "../src/lib/permissions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

const SIZES = ["30", "32", "34", "36", "38", "40"];
const STOCK: Record<string, number> = { "30": 4, "32": 8, "34": 10, "36": 10, "38": 6, "40": 4 };

const PRODUCTS = [
  {
    name: "The Solana", slug: "the-solana", price: 239900, mrp: 449900, badge: "Bestseller", featured: true, cat: "tooled-beaded",
    tagline: "Hand-painted sunflowers and prickly pear on carved brown leather.",
    description:
      "The Solana is our brightest belt. Sunflowers and prickly pear are carved into dark brown full-grain cowhide, then painted by hand in yellow, green and red. A band of sunset beadwork sits at the back of the belt, so the colour carries all the way round. It closes with an engraved western buckle in silver tone and a tooled leather keeper.\n\nWear it with dark denim or plain chinos and let the belt do the talking. Because every belt is carved and painted by hand, the flowers on yours will sit slightly differently from the photos.",
    leather: "Dark brown full-grain cowhide", buckle: "Engraved western buckle, silver tone",
    colors: ["#3A2418", "#E5B92B", "#2E8B57"], tags: ["beaded", "painted"],
    images: [["solana-ring", "The Solana belt fastened, showing sunflowers and cactus around the buckle"],
             ["solana-coil", "The Solana belt coiled, showing the sunset beadwork panel"],
             ["solana-detail", "Close-up of the hand-painted sunflowers on The Solana"]],
  },
  {
    name: "The Mesa", slug: "the-mesa", price: 219900, mrp: 439900, badge: "New", featured: true, cat: "tooled-beaded",
    tagline: "Turquoise and sunset beadwork between scrolls carved on black.",
    description:
      "The Mesa pairs two crafts on one belt. Saddle-tan scrollwork is carved and stamped into black-dyed full-grain leather, set with three white floral conchos. Between the carving runs a long panel of turquoise, red and yellow seed beads in a sunset feather pattern, strung by hand and set into the belt before it is lined.\n\nThe engraved silver-tone buckle and tooled keeper finish it in classic western style. It works as well with black jeans as it does with a white shirt and trousers.",
    leather: "Black and saddle-tan full-grain cowhide", buckle: "Engraved western buckle, silver tone",
    colors: ["#1F1714", "#3FBFB5", "#D9452B"], tags: ["beaded", "dark"],
    images: [["mesa-ring", "The Mesa belt fastened, showing carved scrolls and floral conchos"],
             ["mesa-coil", "The Mesa belt coiled, showing the turquoise sunset beadwork"],
             ["mesa-stack", "The Mesa buckle and beadwork stacked"],
             ["mesa-detail", "Close-up of the carved scrollwork and conchos on The Mesa"]],
  },
  {
    name: "The Azure", slug: "the-azure", price: 249900, mrp: 449900, featured: true, cat: "tooled-beaded",
    tagline: "Natural tan leather carved with acorns and leaves over turquoise.",
    description:
      "The Azure is carved in natural vegetable-tan leather, the lightest hide we use. Acorns, oak leaves and scrolls are cut and stamped by hand, and the background is painted turquoise so the carving stands out in relief. At the back, a beaded panel of blue, black and white diamonds adds a geometric contrast to the flowing leafwork.\n\nNatural tan leather darkens to a warm honey colour as you wear it, so your Azure will look richer after a few months than on the day it arrives.",
    leather: "Natural vegetable-tan full-grain cowhide", buckle: "Engraved western buckle, antique silver",
    colors: ["#D7A57E", "#3BA8A0", "#2F6FB3"], tags: ["beaded", "painted"],
    images: [["azure-ring", "The Azure belt fastened, showing turquoise carved leaves"],
             ["azure-coil", "The Azure belt coiled, showing blue diamond beadwork"],
             ["azure-stack", "The Azure buckle and beadwork stacked"],
             ["azure-detail", "Close-up of the carved acorns and leaves on The Azure"]],
  },
  {
    name: "The Noir", slug: "the-noir", price: 199900, mrp: 379900, featured: true, cat: "everyday",
    tagline: "Plain black leather with a single inlay of blue diamond beadwork.",
    description:
      "The Noir is the quiet one. A smooth black full-grain strap with contrast stitching carries a single inlay of blue, brown and white diamond beadwork, so it reads as a plain black belt from a distance and shows its detail up close. It closes with a brushed steel prong buckle that suits office trousers and weekend denim alike.\n\nIf you want one beaded belt you can wear every day, start here.",
    leather: "Black full-grain cowhide", buckle: "Brushed steel prong buckle",
    colors: ["#141414", "#4BA3D9", "#8A6235"], tags: ["beaded", "dark"],
    images: [["noir-coil", "The Noir black leather belt with blue diamond beadwork and steel buckle"]],
  },
];

const PAGES = [
  { slug: "about", title: "About VELMONT", seoTitle: "About VELMONT: hand-tooled leather belt makers", seoDescription: "VELMONT makes hand-tooled full-grain leather belts in small batches: carved, hand-painted and beaded designs finished with engraved buckles.",
    body: "## Made slowly, by hand\n\nVELMONT makes belts the long way. Each one starts as a strip of full-grain cowhide that is traced, carved with a swivel knife and stamped to raise the pattern. Some are painted by hand, and some carry beadwork that is strung bead by bead and set into the leather.\n\n## Why full-grain\n\nFull-grain is the top layer of the hide with nothing sanded away. It is the strongest leather you can buy and it is the only kind that develops a patina, darkening and softening as you wear it.\n\n## Small batches\n\nWe make belts in small runs, so popular sizes sometimes sell out. If your size is missing, write to us and we will tell you when the next batch is ready." },
  { slug: "shipping", title: "Shipping", seoTitle: "Shipping and delivery times across India", seoDescription: "Free shipping on every VELMONT order across India. Belts dispatch in 1 to 2 business days and arrive in 3 to 7, with tracking by email.",
    body: "## Free shipping across India\n\nEvery order ships free to any pincode we can reach.\n\n## When will my order arrive?\n\nWe dispatch in 1 to 2 business days. Delivery usually takes 3 to 7 business days after dispatch, depending on your city.\n\n## Tracking\n\nAs soon as your belt ships we email you the courier name and tracking number. You can also check status any time on the Track order page with your order number and email.\n\n## Cash on delivery\n\nCash on delivery is available on most pincodes for a small handling fee shown at checkout." },
  { slug: "returns", title: "Exchanges and returns", seoTitle: "Size exchanges, returns and refunds", seoDescription: "Exchange an unworn VELMONT belt for another size within 7 days of delivery. How to start an exchange, damaged items and refund timelines.",
    body: "## 7-day size exchange\n\nIf your belt does not fit, you can exchange it for another size within 7 days of delivery. The belt must be unworn, with no new holes or creases, and in its original box.\n\n## How to start an exchange\n\nWrite to us from the Contact page with your order number and the size you need. We will arrange a pickup where available.\n\n## Damaged or wrong item\n\nIf something arrives damaged or you received the wrong belt, contact us within 48 hours of delivery with a photo and we will replace it at no cost.\n\n## Refunds\n\nRefunds for prepaid orders go back to the original payment method within 5 to 7 business days of approval. Cash on delivery refunds are paid by bank transfer." },
  { slug: "care", title: "Leather care", seoTitle: "How to care for a tooled leather belt", seoDescription: "Keep a hand-tooled full-grain leather belt looking good: everyday wiping, conditioning twice a year, and caring for painted and beaded areas.",
    body: "## Everyday care\n\nWipe your belt with a dry soft cloth after wearing. Hang it or lay it flat rather than rolling it tightly.\n\n## Conditioning\n\nApply a small amount of leather conditioner twice a year. Test on the back of the belt first, rub it in with a cloth and let it dry overnight.\n\n## Painted and beaded areas\n\nDo not use conditioner on painted flowers or beadwork. Clean those areas with a barely damp cloth only.\n\n## If it gets wet\n\nBlot it dry and let it dry naturally away from heaters and direct sun." },
  { slug: "privacy", title: "Privacy policy", seoTitle: "Privacy policy and how we use your data", seoDescription: "What information VELMONT collects when you order, how it is used to ship and support your order, who it is shared with, and your choices.",
    body: "## What we collect\n\nWhen you order, we collect your name, email, phone number and delivery address so we can ship your belt and send updates. Payments are processed by Razorpay. We never see or store your card or UPI details.\n\n## How we use it\n\nWe use your details to fulfil orders, provide support and, if you opt in, send occasional emails about new belts. You can unsubscribe at any time.\n\n## Who we share it with\n\nWe share your delivery details with our courier partner and payment details with Razorpay, only as needed to complete your order. We do not sell your information.\n\n## Your choices\n\nYou can view and update your details from your account, or write to us to delete your account." },
  { slug: "terms", title: "Terms of sale", seoTitle: "Terms of sale for VELMONT orders", seoDescription: "Terms for buying from VELMONT: when an order is confirmed, prices in rupees including GST, and natural variation in handmade leather belts.",
    body: "## Orders\n\nAn order is confirmed once payment succeeds or, for cash on delivery, once we send the confirmation email. We may cancel an order if an item is out of stock, and will refund any payment in full.\n\n## Prices\n\nAll prices are in Indian rupees and include GST.\n\n## Handmade variation\n\nEach belt is carved and painted by hand. Small differences in pattern and colour from the photos are part of the craft and are not defects.\n\n## Contact\n\nFor any question about an order, use the Contact page." },
];

const FAQS = [
  ["How do I choose my belt size?", "Take the waist size of the trousers you will wear the belt with and add 2 inches. A 32 inch waist needs a size 34 belt. The size guide on every product page does this for you."],
  ["Is the leather genuine?", "Yes. Every VELMONT belt is made from full-grain cowhide, the top layer of the hide, which is the strongest grade of leather and the one that develops a patina with wear."],
  ["How long does delivery take?", "Orders dispatch in 1 to 2 business days and usually arrive 3 to 7 business days later. Shipping is free across India."],
  ["Can I exchange the size?", "Yes. You can exchange an unworn belt for another size within 7 days of delivery. Contact us with your order number to start."],
  ["Do you offer cash on delivery?", "Yes, on most pincodes. A small cash handling fee is added at checkout."],
  ["Will my belt look exactly like the photo?", "Very close, but not identical. Each belt is carved and painted by hand, so the flowers, leaves and beadwork vary slightly from piece to piece."],
  ["How do I care for a tooled leather belt?", "Wipe it with a dry cloth, condition the plain leather twice a year and keep conditioner away from painted and beaded areas."],
  ["Can I change the buckle?", "Yes. The buckle is fitted on a snap keeper, so you can unsnap it and fit another standard 1.5 inch buckle."],
];

async function main() {
  for (const r of PRESET_ROLES) {
    await db.insert(s.roles).values({ ...r, system: true }).onConflictDoNothing();
  }

  const ownerEmail = (process.env.OWNER_EMAIL || "owner@velmont.in").toLowerCase();
  const existingOwner = await db.query.users.findFirst({ where: eq(s.users.isOwner, true) });
  if (!existingOwner) {
    const pw = process.env.OWNER_PASSWORD || "Velmont@2026";
    await db.insert(s.users).values({
      email: ownerEmail, name: process.env.OWNER_NAME || "Store Owner",
      passwordHash: await bcrypt.hash(pw, 12), kind: "STAFF", isOwner: true,
    });
    console.log(`Owner account created: ${ownerEmail} / ${pw}  (change this password after first sign-in)`);
  }

  const cats = [
    { name: "Tooled & beaded", slug: "tooled-beaded", description: "Carved, painted and beaded western belts.", sortOrder: 0 },
    { name: "Everyday", slug: "everyday", description: "Quieter belts for daily wear.", sortOrder: 1 },
  ];
  for (const c of cats) await db.insert(s.categories).values(c).onConflictDoNothing();
  const catRows = await db.select().from(s.categories);

  for (const [i, p] of PRODUCTS.entries()) {
    const exists = await db.query.products.findFirst({ where: eq(s.products.slug, p.slug) });
    if (exists) continue;
    const [row] = await db.insert(s.products).values({
      name: p.name, slug: p.slug, tagline: p.tagline, description: p.description, price: p.price, mrp: p.mrp,
      status: "ACTIVE", featured: p.featured, badge: p.badge ?? null,
      categoryId: catRows.find((c) => c.slug === p.cat)?.id, leather: p.leather, buckle: p.buckle,
      care: "Wipe dry after wear. Condition plain leather twice a year. Keep conditioner off paint and beads.",
      colors: p.colors, tags: p.tags, sortOrder: i,
      seoTitle: `${p.name} hand-tooled leather belt`, seoDescription: p.tagline + " Full-grain cowhide, sizes 30 to 40, free shipping in India.",
    }).returning();
    await db.insert(s.productImages).values(p.images.map(([file, alt], j) => ({
      productId: row.id, url: `/img/${file}.webp`, alt, sortOrder: j,
    })));
    const code = p.slug.replace("the-", "").slice(0, 3).toUpperCase();
    await db.insert(s.variants).values(SIZES.map((size) => ({
      productId: row.id, size, sku: `VM-${code}-${size}`, stock: STOCK[size],
    })));
  }

  for (const pg of PAGES) await db.insert(s.pages).values(pg).onConflictDoNothing();
  const faqCount = await db.$count(s.faqs);
  if (!faqCount) await db.insert(s.faqs).values(FAQS.map(([question, answer], i) => ({ question, answer, sortOrder: i })));

  await db.insert(s.coupons).values({
    code: "WELCOME10", description: "10% off the first order", type: "PERCENT", value: 10, maxDiscount: 50000, perCustomerLimit: 1,
  }).onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
