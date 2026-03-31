# Amazon Affiliate MCP Server

Ein **Model Context Protocol (MCP) Server**, der KI-Assistenten (Claude, GitHub Copilot, etc.) ermöglicht, Amazon-Produkte zu empfehlen und dabei automatisch deinen Affiliate-Tag einzubauen.

---

## Was macht dieser MCP?

KI-Assistenten erhalten 8 spezialisierte Tools:

| Tool | Beschreibung |
|---|---|
| `amazon_search` | Produktsuche mit Affiliate-Link und optionalem Preisfilter |
| `amazon_product_link` | Direktlink per ASIN mit Affiliate-Tag |
| `amazon_deals` | Aktuelle Deals, Blitzangebote, Outlet, Warehouse |
| `amazon_bestsellers` | Bestseller-Listen je Kategorie |
| `amazon_gift_finder` | Personalisierte Geschenkideen mit Budgetfilter |
| `amazon_compare` | Produktvergleich (2–5 ASINs) mit Affiliate-Links |
| `amazon_promo_content` | Fertige Werbetexte für Twitter, Instagram, Blog, WhatsApp, Telegram, Newsletter |
| `amazon_affiliate_info` | Infos zu Provisionen und Tipps zur Umsatzsteigerung |

---

## Voraussetzungen

- **Node.js** ≥ 18
- Ein Amazon-Partnerprogramm-Konto ([affiliate-program.amazon.de](https://affiliate-program.amazon.de))
- Dein Affiliate-Tag (aktuell konfiguriert: `addonsdeaddonssh`)

> **Wichtig:** Amazon-Affiliate-Tags enden für `.de` normalerweise auf `-21` (z.B. `meintag-21`).  
> Stelle sicher, dass dein Tag in deinem [PartnerNet-Konto](https://affiliate-program.amazon.de) hinterlegt ist.

---

## Installation

```bash
cd ~/amazon-affiliate-mcp
npm install
npm run build
```

---

## In Claude Desktop einbinden

Bearbeite `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "amazon-affiliate": {
      "command": "node",
      "args": ["/Users/DEIN_BENUTZERNAME/amazon-affiliate-mcp/dist/index.js"],
      "env": {
        "AMAZON_AFFILIATE_TAG": "addonsdeaddonssh"
      }
    }
  }
}
```

Ersetze `DEIN_BENUTZERNAME` mit deinem macOS-Benutzernamen (`whoami` im Terminal).

---

## In VS Code / GitHub Copilot einbinden

Erstelle oder bearbeite `.vscode/mcp.json` im Workspace:

```json
{
  "servers": {
    "amazon-affiliate": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/DEIN_BENUTZERNAME/amazon-affiliate-mcp/dist/index.js"],
      "env": {
        "AMAZON_AFFILIATE_TAG": "addonsdeaddonssh"
      }
    }
  }
}
```

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `AMAZON_AFFILIATE_TAG` | `addonsdeaddonssh` | Dein Affiliate-Tag |
| `AMAZON_BASE_URL` | `https://www.amazon.de` | Amazon-Domain (z.B. `.com` für USA) |

---

## Beispiel-Nutzung in der KI

**Nutzer:** „Empfiehl mir gute Bluetooth-Kopfhörer unter 100 Euro."

**KI verwendet `amazon_search`:**
- query: `Bluetooth Kopfhörer`
- category: `elektronik`
- price_max: `100`

**KI antwortet mit:**  
`https://www.amazon.de/s?k=Bluetooth+Kopfhörer&tag=addonsdeaddonssh&i=electronics&high-price=100`

**Jeder Kauf über diesen Link = Provision für dich.**

---

## Verfügbare Kategorien

`elektronik`, `computer`, `bücher`, `mode`, `garten`, `spielzeug`, `sport`, `küche`, `beauty`, `software`, `musik`, `filme`, `lebensmittel`, `auto`, `baby`, `gesundheit`, `bürobedarf`, `haustier`, `schmuck`

---

## Rechtlicher Hinweis

Nach deutschem Recht und den Amazon-Nutzungsbedingungen **muss** bei Affiliate-Links ein Hinweis erfolgen:

> *„Als Amazon-Partner verdiene ich an qualifizierten Käufen. Für dich entstehen keine Mehrkosten."*

Das `amazon_promo_content`-Tool fügt diesen Hinweis automatisch in alle generierten Texte ein.

---

## Entwicklung

```bash
# Direkt starten (ohne Build)
npm run dev

# Build
npm run build

# Produktiv starten
npm start
```

---

## Lizenz

MIT
