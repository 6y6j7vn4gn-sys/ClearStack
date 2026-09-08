/**
 * ClearStack shop config — paste real Stripe Payment Link URLs when ready.
 * Until then, shop.html uses mailto fallback: “Stripe link coming — request quote”.
 *
 * Deposit Payment Links should be for the 50% deposit amounts at list price:
 *   Starter $44.50 · Binder $84.50 · Multi $149.50 · Box $199.50 (per box)
 * Create separate links if you add rush/USB/shred variants, or use one “custom deposit” link.
 *
 * --- Operator cost notes (NEVER show cost or “+50%” / 1.5× to clients) ---
 * Pass-through sell = ceil(cost × 1.5). Approximate operator costs:
 *   USB ~$18 → sell $27 · shred ~$10 → sell $15 · return-mail ~$12 → sell $18 · ups-pickup ~$8 → sell $12
 *   Kits (carton + label materials approx): mailer ~$26→$39 · small ~$43→$65 · letter ~$52→$78
 *   legal ~$61→$92 · medium ~$77→$116 · large ~$123→$185 · xl ~$165→$248 · custom = Quoted
 * Van ($9/mi): LEGACY / NOT offered on public shop — Mina does not drive to clients.
 * Automation starts at Upland, CA 91786 hub. Impress path = prepaid kit + UPS Pickup $12.
 * Receiving: “Upland hub — street on your UPS label after deposit.” Never invent PMB #; never publish home street.
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
  intake: {
    kit:     { id: "kit",     label: "Prepaid UPS kit", short: "Kit" },
    ship:    { id: "ship",    label: "I’ll ship my own box", short: "Ship own" },
    dropoff: { id: "dropoff", label: "Local drop-off", short: "Drop-off" },
    upload:  { id: "upload",  label: "Secure upload", short: "Upload" }
    /* pickup/van intentionally omitted from public shop — hub automation + UPS Pickup only */
  },
  /**
   * Kit sell prices = ceil(operatorCost × 1.5). Costs in file header comments only.
   * custom = Quoted (not billed in cart).
   */
  kits: {
    mailer: { id: "mailer", label: "Mailer", price: 39 },
    small:  { id: "small",  label: "Small",  price: 65 },
    letter: { id: "letter", label: "Letter", price: 78 },
    legal:  { id: "legal",  label: "Legal",  price: 92 },
    medium: { id: "medium", label: "Medium", price: 116 },
    large:  { id: "large",  label: "Large",  price: 185 },
    xl:     { id: "xl",     label: "XL",     price: 248 },
    custom: { id: "custom", label: "Custom", price: 0, quoted: true }
  },
  /** Legacy van rail — not exposed in shop UI. Hub receiving city only. */
  van: {
    hub: "Upland, CA 91786",
    enabled: false,
    perMile: 9,
    minMiles: 3,
    minCharge: 27,
    maxMiles: 40
  },
  hubPublic: "Upland, CA 91786 hub — street on your UPS label after deposit",

  addons: {
    usb: { id: "usb", label: "Encrypted USB", price: 27, note: "Free / included on Multi" },
    rush: { id: "rush", label: "24-Hour Rush", pct: 0.30 },
    shred: { id: "shred", label: "Certified shred", pricePerBox: 15 },
    returnMail: { id: "return-mail", label: "Return-mail labels", price: 18, note: "Hidden when kit (labels included)" },
    upsPickup: { id: "ups-pickup", label: "UPS Pickup at your door", price: 12 },
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
