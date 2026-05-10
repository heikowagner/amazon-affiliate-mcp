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

## Self-Hosting auf eigenem Server (z.B. www.add-ons.de)

Ja, du kannst diesen MCP auf deinem eigenen Server unter deiner Domain betreiben.

Wichtig: Auf einem normalen VPS musst du explizit HTTP-Modus aktivieren.

### 1) Build auf dem Server

```bash
cd /opt/amazon-affiliate-mcp
npm ci
npm run build
```

### 2) Systemd-Service anlegen

Datei: `/etc/systemd/system/amazon-affiliate-mcp.service`

```ini
[Unit]
Description=Amazon Affiliate MCP HTTP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/amazon-affiliate-mcp
Environment=NODE_ENV=production
Environment=MCP_MODE=http
Environment=PORT=3000
Environment=AMAZON_DEFAULT_COUNTRY=de
Environment=AMAZON_AFFILIATE_TAG_DE=deintag-21
Environment=AMAZON_AFFILIATE_TAG=deintag-21
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Service starten:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now amazon-affiliate-mcp
sudo systemctl status amazon-affiliate-mcp
```

### 3) Nginx als Reverse Proxy für www.add-ons.de

Datei: `/etc/nginx/sites-available/www.add-ons.de`

```nginx
server {
  listen 80;
  server_name www.add-ons.de;

  location /mcp {
    proxy_pass http://127.0.0.1:3000/mcp;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /health {
    proxy_pass http://127.0.0.1:3000/health;
    proxy_set_header Host $host;
  }

  location /.well-known/mcp/server-card.json {
    proxy_pass http://127.0.0.1:3000/.well-known/mcp/server-card.json;
    proxy_set_header Host $host;
  }

  location /icon.svg {
    proxy_pass http://127.0.0.1:3000/icon.svg;
    proxy_set_header Host $host;
  }
}
```

Aktivieren:

```bash
sudo ln -s /etc/nginx/sites-available/www.add-ons.de /etc/nginx/sites-enabled/www.add-ons.de
sudo nginx -t
sudo systemctl reload nginx
```

### 4) TLS-Zertifikat (Let's Encrypt)

```bash
sudo certbot --nginx -d www.add-ons.de
```

### 5) Funktion testen

```bash
curl -i https://www.add-ons.de/health
curl -i https://www.add-ons.de/.well-known/mcp/server-card.json
```

Wenn beides mit 200 antwortet, ist dein MCP öffentlich erreichbar unter:

- `https://www.add-ons.de/mcp`
- `https://www.add-ons.de/.well-known/mcp/server-card.json`

Hinweis: Falls du die Root-Domain ohne `www` nutzen willst, ergänze in Nginx zusätzlich `add-ons.de` im `server_name` und im Zertifikat.

---

## In Claude Desktop einbinden

### Lokal (stdio mode)

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

### HTTP Remote (www.add-ons.de)

Bearbeite `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "amazon-affiliate": {
      "url": "https://www.add-ons.de/mcp"
    }
  }
}
```

Diesen Weg kannst du auch für andere MCP-Clients verwenden (GitHub Copilot, VSCode, etc.).

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
