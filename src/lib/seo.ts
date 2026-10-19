import { SITE_URL } from "./env";
import { getSettings } from "./settings";

const abs = (p: string) => (p.startsWith("http") ? p : `${SITE_URL}${p}`);

export async function organizationLd() {
  const s = await getSettings();
  return {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#org`,
    name: s.store.name, legalName: s.store.legalName, url: SITE_URL, logo: abs("/icon.svg"),
    description: s.seo.defaultDescription, email: s.store.email, telephone: s.store.phone,
    address: { "@type": "PostalAddress", streetAddress: s.store.address, addressRegion: s.store.state, addressCountry: "IN" },
    sameAs: s.seo.sameAs.filter(Boolean),
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: s.store.email, telephone: s.store.phone, areaServed: "IN", availableLanguage: ["en", "hi"] },
  };
}

export async function websiteLd() {
  const s = await getSettings();
  return {
    "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: s.store.name, url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#org` },
    potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/shop?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };
}

export function faqLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export async function productLd(p: {
  name: string; slug: string; description: string; price: number; mrp: number; images: { url: string }[];
  variants: { sku: string; size: string; stock: number; active: boolean }[]; leather: string;
  rating: number; reviews: { name: string; rating: number; body: string; title: string; createdAt: Date }[];
  category?: { name: string } | null;
}) {
  const s = await getSettings();
  const inStock = p.variants.some((v) => v.active && v.stock > 0);
  const validUntil = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org", "@type": "Product",
    name: p.name, description: p.description.replace(/\s+/g, " ").slice(0, 5000), url: abs(`/products/${p.slug}`),
    image: p.images.map((i) => abs(i.url)), sku: p.variants[0]?.sku, material: p.leather,
    brand: { "@type": "Brand", name: s.store.name }, category: p.category?.name || "Leather belts",
    offers: {
      "@type": "Offer", url: abs(`/products/${p.slug}`), priceCurrency: "INR", price: (p.price / 100).toFixed(2),
      priceValidUntil: validUntil, itemCondition: "https://schema.org/NewCondition",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@id": `${SITE_URL}/#org` },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: (s.shipping.freeAbove === 0 ? 0 : s.shipping.flatRate / 100).toFixed(2), currency: "INR" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy", applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: s.shipping.exchangeDays, returnMethod: "https://schema.org/ReturnByMail",
      },
    },
    ...(p.reviews.length ? {
      aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.toFixed(1), reviewCount: p.reviews.length },
      review: p.reviews.slice(0, 5).map((r) => ({
        "@type": "Review", author: { "@type": "Person", name: r.name }, datePublished: r.createdAt.toISOString().slice(0, 10),
        name: r.title || undefined, reviewBody: r.body, reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      })),
    } : {}),
  };
}
