import type { AppLocale } from "./api/_lib/locales";

export type CopyKey =
  | "brandSmall"
  | "brand"
  | "eyebrow"
  | "headline"
  | "subhead"
  | "subscribe"
  | "manage"
  | "checking"
  | "opening"
  | "connectShopify"
  | "connecting"
  | "connected"
  | "reconnect"
  | "importProducts"
  | "importing"
  | "loadMore"
  | "optimize"
  | "optimizing"
  | "reviewChanges"
  | "approve"
  | "saveShopify"
  | "saving"
  | "saved"
  | "uiLanguage"
  | "outputLanguage"
  | "emptyProducts"
  | "emptyReview"
  | "quotaError"
  | "paymentError"
  | "shopifyError"
  | "aiError"
  | "validationError"
  | "selectProduct"
  | "shopPlaceholder"
  | "original"
  | "proposed"
  | "usage"
  | "standaloneHint";

export const COPY: Record<AppLocale, Record<CopyKey, string>> = {
  en: {
    brandSmall: "VIRELLO AI",
    brand: "Virello AI Optimizer",
    eyebrow: "SHOPIFY PRODUCT OPTIMIZER",
    headline: "Optimize Shopify products with AI.",
    subhead:
      "Subscribe, connect your store, import products, review AI title, description, SEO and tags, then save to Shopify.",
    subscribe: "Subscribe",
    manage: "Manage Subscription",
    checking: "Checking...",
    opening: "Opening...",
    connectShopify: "Connect Shopify",
    connecting: "Connecting...",
    connected: "Shopify connected",
    reconnect: "Reconnect Shopify",
    importProducts: "Import Products",
    importing: "Importing...",
    loadMore: "Load more",
    optimize: "Optimize with AI",
    optimizing: "Optimizing...",
    reviewChanges: "Review changes",
    approve: "I reviewed these changes and approve saving them to Shopify.",
    saveShopify: "Save to Shopify",
    saving: "Saving...",
    saved: "Saved to Shopify.",
    uiLanguage: "Interface",
    outputLanguage: "Product copy",
    emptyProducts: "No products imported yet.",
    emptyReview: "Optimize a product to review title, description, SEO, tags, and conversion copy.",
    quotaError: "You have used all 1000 AI optimizations for this billing period.",
    paymentError: "An eligible $29.99/month subscription is required.",
    shopifyError: "Reconnect Shopify before importing, optimizing, or saving.",
    aiError: "The AI optimizer could not finish. Nothing was deducted from your monthly allowance.",
    validationError: "Fix the highlighted fields before saving.",
    selectProduct: "Select a product",
    shopPlaceholder: "your-store.myshopify.com",
    original: "Current",
    proposed: "Proposed",
    usage: "AI uses this period",
    standaloneHint: "Works in Shopify Admin and as a standalone dashboard.",
  },
  fil: {
    brandSmall: "VIRELLO AI",
    brand: "Virello AI Optimizer",
    eyebrow: "SHOPIFY PRODUCT OPTIMIZER",
    headline: "I-optimize ang Shopify products gamit ang AI.",
    subhead:
      "Mag-subscribe, ikonekta ang store, mag-import ng products, i-review ang AI title, description, SEO at tags, tapos i-save sa Shopify.",
    subscribe: "Mag-subscribe",
    manage: "Manage Subscription",
    checking: "Tinitingnan...",
    opening: "Binubuksan...",
    connectShopify: "Ikonekta ang Shopify",
    connecting: "Kumokonekta...",
    connected: "Nakakonekta na ang Shopify",
    reconnect: "I-reconnect ang Shopify",
    importProducts: "Mag-import ng Products",
    importing: "Ini-import...",
    loadMore: "Mag-load pa",
    optimize: "I-optimize gamit ang AI",
    optimizing: "Ini-optimize...",
    reviewChanges: "I-review ang mga pagbabago",
    approve: "Na-review ko ang mga pagbabago at payag akong i-save ito sa Shopify.",
    saveShopify: "I-save sa Shopify",
    saving: "Sine-save...",
    saved: "Na-save na sa Shopify.",
    uiLanguage: "Interface",
    outputLanguage: "Product copy",
    emptyProducts: "Wala pang na-import na products.",
    emptyReview: "Mag-optimize muna ng product para ma-review ang title, description, SEO, tags, at conversion copy.",
    quotaError: "Naubos na ang 1000 AI optimizations para sa billing period na ito.",
    paymentError: "Kailangan ng $29.99/month na subscription.",
    shopifyError: "I-reconnect ang Shopify bago mag-import, mag-optimize, o mag-save.",
    aiError: "Hindi natapos ang AI optimizer. Walang ibinawas sa monthly allowance.",
    validationError: "Ayusin muna ang mga field bago mag-save.",
    selectProduct: "Pumili ng product",
    shopPlaceholder: "your-store.myshopify.com",
    original: "Kasalukuyan",
    proposed: "Mungkahi",
    usage: "AI uses ngayong period",
    standaloneHint: "Gumagana sa Shopify Admin at sa standalone dashboard.",
  },
};

export function t(locale: AppLocale, key: CopyKey): string {
  return COPY[locale][key];
}
