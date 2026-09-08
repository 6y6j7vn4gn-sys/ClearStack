/**
 * ClearStack shop config — paste real Stripe Payment Link URLs when ready.
 * Until then, shop.html uses mailto fallback: “Stripe link coming — request quote”.
 *
 * Deposit Payment Links should be for the 50% deposit amounts at list price:
 *   Starter $44.50 · Binder $84.50 · Multi $149.50 · Box $199.50 (per box)
 * Create separate links if you add rush/USB/shred variants, or use one “custom deposit” link.
 */
window.CLEARSTACK_SHOP = {
  brand: "ClearStack",
  tagline: "Paper in. Searchable book out.",
  confirmTo: "Mina.Fakhouri@Hotmail.com",
  confirmFromFuture: "hello@goclearstack.com",
  mailtoFallback: "mailto:Mina.Fakhouri@Hotmail.com?subject=ClearStack%20deposit%20%E2%80%94%20Stripe%20link%20coming",
  zelle: {
    displayName: "ClearStack",
    tokenStatus: "pending Chase Business",
    instructions: "Zelle to ClearStack — token pending Chase Business"
  },
  packages: {
    starter: { id: "starter", name: "Personal / Legal Starter", short: "Starter", price: 89, pages: "Up to 150 pages" },
    binder:  { id: "binder",  name: "Standard Binder Archival", short: "Binder",  price: 169, pages: "Up to 500 pages" },
    multi:   { id: "multi",   name: "Multi-Binder / Small Archive", short: "Multi", price: 299, pages: "Up to 1,200 pages", usbIncluded: true },
    box:     { id: "box",     name: "The Banker’s Box", short: "Box", price: 399, pages: "~2,500 pages / box", qtyEnabled: true }
  },
  addons: {
    usb: { id: "usb", label: "Encrypted USB", price: 25, note: "Free / included on Multi" },
    rush: { id: "rush", label: "24-Hour Rush", pct: 0.30 },
    shred: { id: "shred", label: "Certified shred", pricePerBox: 15 },
    indexing: { id: "indexing", label: "Custom indexing note", hourly: 35, quoted: true }
  },
  /** Paste live Stripe Payment Link URLs here (deposit at list 50%). Empty = mailto fallback. */
  stripePaymentLinks: {
    starter: "",
    binder: "",
    multi: "",
    box: ""
  },
  zelleDiscount: 0.15,
  depositPct: 0.50
};
