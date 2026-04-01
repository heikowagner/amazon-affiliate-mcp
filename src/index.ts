#!/usr/bin/env node
/**
 * Amazon Affiliate MCP Server
 *
 * Stellt KI-Assistenten Tools bereit, um Amazon-Produktlinks mit Affiliate-Tag
 * zu generieren, Angebote zu finden und Werbetexte zu erstellen.
 *
 * Affiliate-Tag: addonsdeaddonssh
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";

// ── Länder-Konfiguration ─────────────────────────────────────────────────────
interface LandConfig {
  domain: string;
  name: string;
  currency: string;
  tag: string;
}

const LAENDER: Record<string, LandConfig> = {
  de: { domain: "https://www.amazon.de",     name: "Deutschland",    currency: "EUR", tag: process.env.AMAZON_AFFILIATE_TAG_DE ?? process.env.AMAZON_AFFILIATE_TAG ?? "addonsdeaddonssh" },
  at: { domain: "https://www.amazon.at",     name: "Österreich",     currency: "EUR", tag: process.env.AMAZON_AFFILIATE_TAG_AT ?? "" },
  us: { domain: "https://www.amazon.com",    name: "USA",            currency: "USD", tag: process.env.AMAZON_AFFILIATE_TAG_US ?? "addonsdeaddon-20" },
  uk: { domain: "https://www.amazon.co.uk",  name: "Großbritannien", currency: "GBP", tag: process.env.AMAZON_AFFILIATE_TAG_UK ?? "" },
  fr: { domain: "https://www.amazon.fr",     name: "Frankreich",     currency: "EUR", tag: process.env.AMAZON_AFFILIATE_TAG_FR ?? "" },
  es: { domain: "https://www.amazon.es",     name: "Spanien",        currency: "EUR", tag: process.env.AMAZON_AFFILIATE_TAG_ES ?? "" },
  it: { domain: "https://www.amazon.it",     name: "Italien",        currency: "EUR", tag: process.env.AMAZON_AFFILIATE_TAG_IT ?? "" },
  nl: { domain: "https://www.amazon.nl",     name: "Niederlande",    currency: "EUR", tag: process.env.AMAZON_AFFILIATE_TAG_NL ?? "" },
  pl: { domain: "https://www.amazon.pl",     name: "Polen",          currency: "PLN", tag: process.env.AMAZON_AFFILIATE_TAG_PL ?? "" },
  se: { domain: "https://www.amazon.se",     name: "Schweden",       currency: "SEK", tag: process.env.AMAZON_AFFILIATE_TAG_SE ?? "" },
  jp: { domain: "https://www.amazon.co.jp",  name: "Japan",          currency: "JPY", tag: process.env.AMAZON_AFFILIATE_TAG_JP ?? "" },
  ca: { domain: "https://www.amazon.ca",     name: "Kanada",         currency: "CAD", tag: process.env.AMAZON_AFFILIATE_TAG_CA ?? "" },
  au: { domain: "https://www.amazon.com.au", name: "Australien",     currency: "AUD", tag: process.env.AMAZON_AFFILIATE_TAG_AU ?? "" },
  mx: { domain: "https://www.amazon.com.mx", name: "Mexiko",         currency: "MXN", tag: process.env.AMAZON_AFFILIATE_TAG_MX ?? "" },
  br: { domain: "https://www.amazon.com.br", name: "Brasilien",      currency: "BRL", tag: process.env.AMAZON_AFFILIATE_TAG_BR ?? "" },
  in: { domain: "https://www.amazon.in",     name: "Indien",         currency: "INR", tag: process.env.AMAZON_AFFILIATE_TAG_IN ?? "" },
  sg: { domain: "https://www.amazon.sg",     name: "Singapur",       currency: "SGD", tag: process.env.AMAZON_AFFILIATE_TAG_SG ?? "" },
  ae: { domain: "https://www.amazon.ae",     name: "VAE",            currency: "AED", tag: process.env.AMAZON_AFFILIATE_TAG_AE ?? "" },
  sa: { domain: "https://www.amazon.com.sa", name: "Saudi-Arabien",  currency: "SAR", tag: process.env.AMAZON_AFFILIATE_TAG_SA ?? "" },
  tr: { domain: "https://www.amazon.com.tr", name: "Türkei",         currency: "TRY", tag: process.env.AMAZON_AFFILIATE_TAG_TR ?? "" },
};

const LAND_CODES = Object.keys(LAENDER) as [string, ...string[]];
const DEFAULT_COUNTRY = (process.env.AMAZON_DEFAULT_COUNTRY ?? "de").toLowerCase() as keyof typeof LAENDER;

function getLand(country?: string): LandConfig {
  const c = (country ?? DEFAULT_COUNTRY).toLowerCase();
  return LAENDER[c] ?? LAENDER["de"]!;
}

// ── Kategorie-Mapping (Amazon browse-node Schlüssel) ─────────────────────────
const CATEGORIES: Record<string, string> = {
  elektronik: "electronics",
  computer: "computers",
  bücher: "stripbooks",
  mode: "fashion",
  "haus & garten": "garden",
  garten: "garden",
  spielzeug: "toys",
  sport: "sporting",
  küche: "kitchen",
  beauty: "beauty",
  software: "software",
  musik: "music",
  filme: "dvd",
  lebensmittel: "grocery",
  auto: "automotive",
  baby: "baby",
  gesundheit: "hpc",
  bürobedarf: "office-products",
  haustier: "pets",
  schmuck: "jewelry",
};
const CATEGORY_KEYS = Object.keys(CATEGORIES).join(", ");

// ── URL-Builder ───────────────────────────────────────────────────────────────
function buildSearchUrl(
  query: string,
  country?: string,
  category?: string,
  priceMin?: number,
  priceMax?: number
): string {
  const land = getLand(country);
  const params = new URLSearchParams({
    k: query,
    tag: land.tag,
    ref: "sr_nr_p_36_0",
  });
  const cat = category?.toLowerCase();
  if (cat && CATEGORIES[cat]) params.set("i", CATEGORIES[cat]);
  if (priceMin !== undefined) params.set("low-price", String(priceMin));
  if (priceMax !== undefined) params.set("high-price", String(priceMax));
  return `${land.domain}/s?${params.toString()}`;
}

function buildProductUrl(asin: string, country?: string): string {
  const land = getLand(country);
  return `${land.domain}/dp/${encodeURIComponent(asin)}?tag=${land.tag}`;
}

function buildDealsUrl(country?: string, type?: string): string {
  const land = getLand(country);
  const base = land.domain;
  const tag = land.tag;
  switch (type) {
    case "blitzangebote":
      return `${base}/deals?tag=${tag}&ref=nav_cs_gb`;
    case "outlet":
      return `${base}/outlet?tag=${tag}`;
    case "warehouse":
      return `${base}/gp/goldbox?tag=${tag}`;
    case "prime":
      return `${base}/prime?tag=${tag}`;
    default:
      return `${base}/deals?tag=${tag}`;
  }
}

function buildBestsellerUrl(country?: string, category?: string): string {
  const land = getLand(country);
  const cat = category?.toLowerCase();
  const node = cat ? CATEGORIES[cat] : undefined;
  return node
    ? `${land.domain}/bestsellers/${node}?tag=${land.tag}`
    : `${land.domain}/bestsellers?tag=${land.tag}`;
}

// ── Server-Factory ──────────────────────────────────────────────────────────────
function createMcpServer() {
const server = new McpServer({
  name: "amazon Affiliate MCP",
  version: "1.0.0",
  description:
    "Search Amazon products and generate affiliate links across 20 countries (DE, US, UK, FR, IT, ES, CA, AU, JP and more). " +
    "Tools for product search, direct ASIN links, deals, bestsellers, gift finder, product comparison, promo content generation, and affiliate setup info. " +
    "Ideal for AI agents that recommend products and earn commissions via Amazon Associates.",
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1 – Produktsuche
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_search",
  `Search for products on Amazon in any supported country and return a ready-to-use affiliate link.
  Use this tool whenever a user asks for product recommendations or shopping suggestions.
  Supports optional category filtering and price range.
  Available countries: ${LAND_CODES.join(", ")}
  Available categories: ${CATEGORY_KEYS}`,
  {
    query: z.string().min(1).describe("Search term, e.g. 'Bluetooth headphones' or 'running shoes'"),
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code, e.g. de, us, uk, fr, it, es, jp, ca. Default: ${DEFAULT_COUNTRY}`),
    category: z
      .string()
      .optional()
      .describe(`Product category filter, e.g. "${CATEGORY_KEYS}"`),
    price_min: z
      .number()
      .min(0)
      .optional()
      .describe("Minimum price in the local currency of the selected country"),
    price_max: z
      .number()
      .min(0)
      .optional()
      .describe("Maximum price in the local currency of the selected country"),
  },
  async ({ query, country, category, price_min, price_max }) => {
    const land = getLand(country);
    const url = buildSearchUrl(query, country, category, price_min, price_max);
    const priceInfo =
      price_min !== undefined || price_max !== undefined
        ? ` (${price_min ?? 0} – ${price_max ?? "∞"} ${land.currency})`
        : "";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              query,
              land: land.name,
              domain: land.domain,
              currency: land.currency,
              affiliate_tag: land.tag,
              category: category ?? "alle Kategorien",
              price_range: priceInfo || "kein Filter",
              affiliate_search_url: url,
              hinweis:
                "Dieser Link enthält deinen Affiliate-Tag. Klicks und Käufe über diesen Link generieren Provision.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2 – Produkt-Direktlink via ASIN
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_product_link",
  "Generate a direct Amazon affiliate link for a specific product using its ASIN. " +
  "Use this when you already know the exact product (10-character ASIN) and want a clean, trackable link for any supported Amazon country.",
  {
    asin: z
      .string()
      .min(10)
      .max(10)
      .describe("10-character Amazon ASIN, e.g. B08N5WRWNW"),
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code, e.g. de, us, uk. Default: ${DEFAULT_COUNTRY}`),
    product_name: z
      .string()
      .optional()
      .describe("Optional product name to include in the response for display purposes"),
  },
  async ({ asin, country, product_name }) => {
    const cleanAsin = asin.trim().toUpperCase();
    const land = getLand(country);
    const url = buildProductUrl(cleanAsin, country);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              asin: cleanAsin,
              land: land.name,
              domain: land.domain,
              affiliate_tag: land.tag,
              product_name: product_name ?? "Produkt",
              affiliate_url: url,
              hinweis:
                "Empfehle diesen Link direkt – bei jedem Kauf erhältst du Affiliate-Provision.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 – Angebote & Deals
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_deals",
  "Get affiliate links to current Amazon deals and offers for any supported country. " +
  "Supports flash deals (lightning), outlet discounts, warehouse (open-box) items, and Prime-exclusive offers. " +
  "Great for sharing time-sensitive promotions that convert well.",
  {
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code. Default: ${DEFAULT_COUNTRY}`),
    deal_type: z
      .enum(["alle", "blitzangebote", "outlet", "warehouse", "prime"])
      .default("alle")
      .describe(
        "Type of deal: alle (all deals) | blitzangebote (lightning/flash deals) | outlet (clearance) | warehouse (open-box) | prime (Prime-exclusive)"
      ),
  },
  async ({ country, deal_type }) => {
    const land = getLand(country);
    const url = buildDealsUrl(country, deal_type === "alle" ? undefined : deal_type);
    const labels: Record<string, string> = {
      alle: "Alle aktuellen Amazon-Deals",
      blitzangebote: "Zeitlich begrenzte Blitzangebote",
      outlet: "Amazon Outlet – dauerhaft reduzierte Neuware",
      warehouse: "Amazon Warehouse – B-Ware mit bis zu 70 % Rabatt",
      prime: "Exklusive Prime-Angebote",
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              land: land.name,
              domain: land.domain,
              deal_type,
              beschreibung: labels[deal_type],
              affiliate_url: url,
              tipp:
                "Blitzangebote teilen solange der Vorrat reicht – sie konvertieren besonders gut!",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4 – Bestseller
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_bestsellers",
  `Return an affiliate link to the Amazon bestseller list for a specific category and country.
  Bestseller links consistently outperform generic search links in click-through and conversion rates.
  Available categories: ${CATEGORY_KEYS}`,
  {
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code. Default: ${DEFAULT_COUNTRY}`),
    category: z
      .string()
      .optional()
      .describe("Product category, e.g. elektronik (electronics), bücher (books), spielzeug (toys)"),
  },
  async ({ country, category }) => {
    const land = getLand(country);
    const url = buildBestsellerUrl(country, category);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              land: land.name,
              domain: land.domain,
              category: category ?? "alle Kategorien",
              affiliate_bestseller_url: url,
              verfügbare_kategorien: Object.keys(CATEGORIES),
              tipp:
                "Bestseller-Links in Empfehlungen einbauen steigert Klickrate und Provision.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 5 – Geschenkfinder
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_gift_finder",
  "Generate personalized Amazon gift idea links with affiliate tags for any country. " +
  "Tailors search links based on recipient description, interests, budget range, and occasion. " +
  "Always includes an Amazon gift card as a reliable fallback option.",
  {
    empfaenger: z
      .string()
      .min(1)
      .describe("Description of the gift recipient, e.g. 'man 40, loves sports' or 'teenage girl into gaming'"),
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code. Default: ${DEFAULT_COUNTRY}`),
    budget_min: z.number().min(0).optional().describe("Minimum budget in the local currency of the selected country"),
    budget_max: z.number().min(0).optional().describe("Maximum budget in the local currency of the selected country"),
    interessen: z
      .array(z.string())
      .max(5)
      .optional()
      .describe("List of interests or hobbies, e.g. ['gaming', 'cooking', 'reading'] (max 5)"),
    anlass: z
      .string()
      .optional()
      .describe("Occasion for the gift, e.g. Birthday, Christmas, Wedding"),
  },
  async ({ empfaenger, country, budget_min, budget_max, interessen = [], anlass }) => {
    const land = getLand(country);
    const suchanfragen: Array<{ name: string; url: string }> = [];

    // Gezielte Suchen nach Interessen (max. 4)
    for (const interesse of interessen.slice(0, 4)) {
      const params = new URLSearchParams({
        k: `${interesse} gift`,
        tag: land.tag,
      });
      if (budget_min !== undefined) params.set("low-price", String(budget_min));
      if (budget_max !== undefined) params.set("high-price", String(budget_max));
      suchanfragen.push({
        name: `${interesse} – Geschenkideen`,
        url: `${land.domain}/s?${params.toString()}`,
      });
    }

    // Generische Suche als Fallback
    if (interessen.length === 0) {
      const params = new URLSearchParams({
        k: `gift ${empfaenger}`,
        tag: land.tag,
      });
      if (budget_min !== undefined) params.set("low-price", String(budget_min));
      if (budget_max !== undefined) params.set("high-price", String(budget_max));
      suchanfragen.push({
        name: "Allgemeine Geschenkideen",
        url: `${land.domain}/s?${params.toString()}`,
      });
    }

    // Immer: Gutschein als sichere Option
    suchanfragen.push({
      name: "Amazon Geschenkgutschein (immer passend)",
      url: `${land.domain}/dp/B004LLIKVU?tag=${land.tag}`,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              land: land.name,
              currency: land.currency,
              empfaenger,
              anlass: anlass ?? "kein bestimmter Anlass",
              budget:
                budget_max !== undefined
                  ? `${budget_min ?? 0} – ${budget_max} ${land.currency}`
                  : budget_min !== undefined
                  ? `ab ${budget_min} ${land.currency}`
                  : "kein Budget definiert",
              geschenkideen: suchanfragen,
              empfehlung: `${suchanfragen.length} personalisierte Links für ${empfaenger}${anlass ? ` zum ${anlass}` : ""} erstellt.`,
              affiliate_tag_aktiv: true,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 6 – Produktvergleich
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_compare",
  "Build a structured side-by-side comparison of 2–5 Amazon products with affiliate links for any supported country. " +
  "Returns ranked product entries with names and affiliate URLs. " +
  "Product comparisons increase engagement and click-through rates significantly.",
  {
    asins: z
      .array(z.string().length(10))
      .min(2)
      .max(5)
      .describe("List of Amazon ASINs to compare (each exactly 10 characters), e.g. ['B08N5WRWNW', 'B09G9FPHY6']"),
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code. Default: ${DEFAULT_COUNTRY}`),
    produktnamen: z
      .array(z.string())
      .optional()
      .describe("Optional product names in the same order as the ASINs, used for display"),
  },
  async ({ asins, country, produktnamen = [] }) => {
    const land = getLand(country);
    const produkte = asins.map((asin, i) => ({
      rang: i + 1,
      asin: asin.trim().toUpperCase(),
      name: produktnamen[i] ?? `Produkt ${i + 1}`,
      affiliate_url: buildProductUrl(asin.trim().toUpperCase(), country),
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              land: land.name,
              domain: land.domain,
              vergleich_anzahl: produkte.length,
              produkte,
              hinweis:
                "Präsentiere diese Links nebeneinander – alle enthalten deinen Affiliate-Tag.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 7 – Werbetext-Generator
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_promo_content",
  "Generate ready-to-publish promotional content for Amazon products with embedded affiliate links. " +
  "Supports Twitter/X, Instagram, blog (HTML), WhatsApp, Telegram, and newsletter (HTML email) formats. " +
  "Output is available in German (de) and English (en) and includes mandatory affiliate disclosure text.",
  {
    produktname: z.string().min(1).describe("Name of the product to promote"),
    country: z
      .enum(LAND_CODES)
      .default(DEFAULT_COUNTRY)
      .describe(`Amazon storefront country code. Default: ${DEFAULT_COUNTRY}`),
    asin: z.string().length(10).optional().describe("Amazon ASIN (10 characters) for a direct product link"),
    suchbegriff: z
      .string()
      .optional()
      .describe("Search term fallback when no ASIN is available"),
    plattform: z
      .enum(["twitter", "instagram", "blog", "whatsapp", "telegram", "newsletter"])
      .describe("Target platform for the promotional content"),
    sprache: z
      .enum(["de", "en"])
      .default("de")
      .describe("Output language: de (German) or en (English)"),
    preis: z.string().optional().describe("Product price to include in the copy, e.g. '$29.99'"),
  },
  async ({ produktname, country, asin, suchbegriff, plattform, sprache, preis }) => {
    const url = asin
      ? buildProductUrl(asin.trim().toUpperCase(), country)
      : buildSearchUrl(suchbegriff ?? produktname, country);

    const preisInfo = preis ? ` – nur ${preis}` : "";

    const templates: Record<string, Record<"de" | "en", string>> = {
      twitter: {
        de: `🛒 *${produktname}*${preisInfo} – jetzt auf Amazon!\n\n⭐ Top-Bewertungen, schnelle Lieferung!\n👉 ${url}\n\n#Amazon #Shopping #Deal #Empfehlung`,
        en: `🛒 *${produktname}*${preisInfo} – now on Amazon!\n\n⭐ Top reviews, fast delivery!\n👉 ${url}\n\n#Amazon #Shopping #Deal #Recommendation`,
      },
      instagram: {
        de: `✨ ${produktname} ✨${preisInfo}\n\nEines meiner absoluten Lieblingsprodukte! 💯\nSuper Qualität & unschlagbarer Preis.\n\n🔗 Link in Bio oder direkt hier:\n${url}\n\n#Amazon #AmazonDE #Shopping #Empfehlung #MustHave`,
        en: `✨ ${produktname} ✨${preisInfo}\n\nOne of my absolute favorites! 💯\nAmazing quality & unbeatable price.\n\n🔗 Link in bio or direct:\n${url}\n\n#Amazon #Shopping #Recommendation #MustHave`,
      },
      blog: {
        de: `<h2>${produktname}</h2>\n<p>Dieses Produkt überzeugt durch seine hervorragende Qualität und das unschlagbare Preis-Leistungs-Verhältnis${preisInfo}.</p>\n<p><a href="${url}" target="_blank" rel="nofollow sponsored">➡️ Jetzt auf Amazon ansehen</a></p>\n<p><small><em>*Affiliate-Link: Als Amazon-Partner verdiene ich an qualifizierten Käufen. Für dich entstehen keine Mehrkosten.</em></small></p>`,
        en: `<h2>${produktname}</h2>\n<p>This product impresses with its outstanding quality and unbeatable value${preisInfo}.</p>\n<p><a href="${url}" target="_blank" rel="nofollow sponsored">➡️ View on Amazon</a></p>\n<p><small><em>*Affiliate link: As an Amazon Associate I earn from qualifying purchases at no extra cost to you.</em></small></p>`,
      },
      whatsapp: {
        de: `Hey! Schau mal hier 👀\n\n*${produktname}*${preisInfo}\n\nSuper Empfehlung! 🔥 Schnell bestellen, solange vorrätig:\n${url}`,
        en: `Hey! Check this out 👀\n\n*${produktname}*${preisInfo}\n\nHighly recommended! 🔥 Order fast while in stock:\n${url}`,
      },
      telegram: {
        de: `🛍 **${produktname}**${preisInfo}\n\n✅ Top-Empfehlung!\nJetzt auf Amazon bestellen:\n${url}\n\n_Affiliate-Link – unterstützt diesen Kanal!_`,
        en: `🛍 **${produktname}**${preisInfo}\n\n✅ Highly recommended!\nOrder on Amazon now:\n${url}\n\n_Affiliate link – supports this channel!_`,
      },
      newsletter: {
        de: `<table width="600" cellpadding="0" cellspacing="0">\n  <tr>\n    <td style="padding:16px">\n      <h3 style="color:#e47911">${produktname}</h3>\n      <p>Unser Produkt-Tipp der Woche${preisInfo}:</p>\n      <a href="${url}" style="background:#e47911;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">Jetzt auf Amazon ansehen</a>\n      <p><small>Affiliate-Link – bei Kauf erhalte ich eine kleine Provision, für dich ohne Mehrkosten.</small></p>\n    </td>\n  </tr>\n</table>`,
        en: `<table width="600" cellpadding="0" cellspacing="0">\n  <tr>\n    <td style="padding:16px">\n      <h3 style="color:#e47911">${produktname}</h3>\n      <p>Our product tip of the week${preisInfo}:</p>\n      <a href="${url}" style="background:#e47911;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">View on Amazon</a>\n      <p><small>Affiliate link – I earn a small commission at no extra cost to you.</small></p>\n    </td>\n  </tr>\n</table>`,
      },
    };

    const content = templates[plattform][sprache];
    const pflichthinweis =
      sprache === "de"
        ? "Pflichtangabe: Als Amazon-Partner verdiene ich an qualifizierten Käufen."
        : "Required disclosure: As an Amazon Associate I earn from qualifying purchases.";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              plattform,
              sprache,
              produktname,
              affiliate_url: url,
              werbetext: content,
              pflichthinweis,
              zeichen_anzahl: content.length,
              tipp:
                plattform === "twitter"
                  ? "Twitter/X-Limit: 280 Zeichen – ggf. kürzen."
                  : "Kopiere den Werbetext direkt.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool 8 – Affiliate-Link-Info
// ─────────────────────────────────────────────────────────────────────────────
server.tool(
  "amazon_affiliate_info",
  "Return a full overview of the active Amazon affiliate configuration: configured tags per country, domains, currencies, commission rates, and best-practice tips. " +
  "Use this to show users which countries are active or to diagnose missing affiliate tags.",
  {},
  async () => {
    const laenderInfo = Object.entries(LAENDER).map(([code, cfg]) => ({
      code,
      land: cfg.name,
      domain: cfg.domain,
      currency: cfg.currency,
      affiliate_tag: cfg.tag || "(nicht konfiguriert)",
      aktiv: cfg.tag.length > 0,
    }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              standard_land: DEFAULT_COUNTRY,
              konfigurierte_laender: laenderInfo,
              provisions_info: {
                elektronik: "bis zu 3 %",
                mode_schuhe: "bis zu 10 %",
                bücher: "bis zu 5 %",
                spielzeug: "bis zu 5 %",
                sport: "bis zu 5 %",
                küche: "bis zu 5 %",
                beauty: "bis zu 6 %",
                lebensmittel: "bis zu 3 %",
                sonstiges: "bis zu 5 %",
              },
              cookie_laufzeit_tage: 24,
              tipps: [
                "Empfehle Produkte im Kontext einer konkreten Nutzerfrage – das erhöht die Klickrate.",
                "Blitzangebote teilen, solange sie aktiv sind – sie konvertieren stark.",
                "Bestseller-Links performen besser als generische Suchen.",
                "Produktvergleiche steigern die Verweildauer und Klickwahrscheinlichkeit.",
                "In Deutschland ist ein Pflichthinweis auf den Affiliate-Status erforderlich.",
                "Länderspezifische Links erhöhen die Conversion bei internationalen Zielgruppen.",
              ],
              pflichthinweis_de:
                "Hinweis: Als Amazon-Partner verdiene ich an qualifizierten Käufen. Für den Käufer entstehen keine Mehrkosten.",
              pflichthinweis_en:
                "Disclosure: As an Amazon Associate I earn from qualifying purchases at no extra cost to you.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

  return server;
}

// ── Smithery Sandbox (für Tool-Scanning beim Publish) ─────────────────────────
export function createSandboxServer() {
  return createMcpServer();
}

// ── HTTP-Modus ────────────────────────────────────────────────────────────────
async function startHttp(port: number): Promise<void> {
  const aktiveTagAnzahl = Object.values(LAENDER).filter((l) => l.tag.length > 0).length;

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health-check für Railway / Smithery
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "amazon-affiliate-mcp" }));
      return;
    }

    if (req.url === "/mcp") {
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(port, () => {
    process.stderr.write(
      `Amazon Affiliate MCP HTTP Server auf Port ${port} | ${aktiveTagAnzahl}/${Object.keys(LAENDER).length} Länder konfiguriert | Standard: ${DEFAULT_COUNTRY}\n`
    );
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const mode = process.env.MCP_MODE ?? (process.env.PORT ? "http" : "stdio");

  if (mode === "http") {
    const port = Number(process.env.PORT ?? 3000);
    await startHttp(port);
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const aktiveTagAnzahl = Object.values(LAENDER).filter((l) => l.tag.length > 0).length;
    process.stderr.write(
      `Amazon Affiliate MCP Server gestartet | ${aktiveTagAnzahl}/${Object.keys(LAENDER).length} Länder konfiguriert | Standard: ${DEFAULT_COUNTRY}\n`
    );
  }
}

main().catch((err) => {
  process.stderr.write(`Fehler: ${String(err)}\n`);
  process.exit(1);
});
