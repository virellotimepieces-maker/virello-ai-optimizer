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
  | "standaloneHint"
  | "subscriptionActivated"
  | "productsLoaded"
  | "checkingShopify"
  | "shopDomainLabel"
  | "connectHeadline"
  | "connectSubhead"
  | "connectedHeadline"
  | "connectedBody"
  | "connectedStore"
  | "connectionComplete"
  | "shopifyConnectedSuccessfully"
  | "shopifyReady"
  | "continueToVirello"
  | "whatsNext"
  | "startOptimizing"
  | "nextBody"
  | "stepImport"
  | "stepImportBody"
  | "stepOptimize"
  | "stepOptimizeBody"
  | "stepReview"
  | "stepReviewBody"
  | "stepApply"
  | "stepApplyBody"
  | "invalidShop"
  | "portalError"
  | "notConnected"
  | "checkoutNeedShop"
  | "wrongHost"
  | "invalidAuthorizeUrl";

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
    subscriptionActivated: "Subscription activated successfully.",
    productsLoaded: "products loaded.",
    checkingShopify: "Checking Shopify connection...",
    shopDomainLabel: "Shopify store domain",
    connectHeadline: "Connect your Shopify store",
    connectSubhead:
      "Connect your Shopify store to import products and optimize them with Virello AI.",
    connectedHeadline: "Your Shopify store is connected.",
    connectedBody: "Your Shopify store has been successfully connected to Virello AI Optimizer.",
    connectedStore: "Connected store",
    connectionComplete: "CONNECTION COMPLETE",
    shopifyConnectedSuccessfully: "Shopify connected successfully",
    shopifyReady: "Virello can now work with your Shopify store.",
    continueToVirello: "Continue to Virello",
    whatsNext: "WHAT'S NEXT?",
    startOptimizing: "Start optimizing your Shopify products.",
    nextBody:
      "Import your products, optimize them with AI, review the recommendations and apply the changes to Shopify.",
    stepImport: "1. Import",
    stepImportBody: "Import your Shopify products.",
    stepOptimize: "2. Optimize",
    stepOptimizeBody: "Generate SEO titles, descriptions and more.",
    stepReview: "3. Review",
    stepReviewBody: "Review AI recommendations.",
    stepApply: "4. Apply",
    stepApplyBody: "Publish changes to Shopify.",
    invalidShop: "Use your Shopify .myshopify.com domain.",
    portalError: "Unable to open subscription management.",
    notConnected: "Not connected yet.",
    checkoutNeedShop: "Enter your Shopify .myshopify.com domain before subscribing.",
    wrongHost: "Open Virello on the canonical app URL:",
    invalidAuthorizeUrl:
      "Shopify authorization must open Admin OAuth, not the public storefront. Open Virello on the canonical app URL and try Connect Shopify again.",
  },
  fil: {
    brandSmall: "VIRELLO AI",
    brand: "Virello AI Optimizer",
    eyebrow: "SHOPIFY PRODUCT OPTIMIZER",
    headline: "I-optimize ang Shopify products gamit ang AI.",
    subhead:
      "Mag-subscribe, ikonekta ang store, mag-import ng products, i-review ang AI title, description, SEO at tags, tapos i-save sa Shopify.",
    subscribe: "Mag-subscribe",
    manage: "I-manage ang Subscription",
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
    subscriptionActivated: "Aktibo na ang subscription.",
    productsLoaded: "products ang na-load.",
    checkingShopify: "Tinitingnan ang koneksyon sa Shopify...",
    shopDomainLabel: "Domain ng Shopify store",
    connectHeadline: "Ikonekta ang iyong Shopify store",
    connectSubhead:
      "Ikonekta ang Shopify store para mag-import ng products at i-optimize ang mga ito gamit ang Virello AI.",
    connectedHeadline: "Nakakonekta na ang iyong Shopify store.",
    connectedBody: "Matagumpay nang nakakonekta ang Shopify store sa Virello AI Optimizer.",
    connectedStore: "Nakakonektang store",
    connectionComplete: "TAPOS NA ANG KONEKSYON",
    shopifyConnectedSuccessfully: "Matagumpay ang koneksyon sa Shopify",
    shopifyReady: "Pwede nang magtrabaho ang Virello sa iyong Shopify store.",
    continueToVirello: "Magpatuloy sa Virello",
    whatsNext: "ANO ANG SUSUNOD?",
    startOptimizing: "Simulan ang pag-optimize ng Shopify products.",
    nextBody:
      "Mag-import ng products, i-optimize gamit ang AI, i-review ang mungkahi, tapos i-apply sa Shopify.",
    stepImport: "1. Import",
    stepImportBody: "I-import ang iyong Shopify products.",
    stepOptimize: "2. Optimize",
    stepOptimizeBody: "Gumawa ng SEO titles, descriptions, at iba pa.",
    stepReview: "3. Review",
    stepReviewBody: "I-review ang mga mungkahi ng AI.",
    stepApply: "4. Apply",
    stepApplyBody: "I-publish ang mga pagbabago sa Shopify.",
    invalidShop: "Gamitin ang .myshopify.com domain ng store.",
    portalError: "Hindi mabuksan ang subscription management.",
    notConnected: "Hindi pa nakakonekta.",
    checkoutNeedShop: "Ilagay muna ang .myshopify.com domain bago mag-subscribe.",
    wrongHost: "Buksan ang Virello sa tamang app URL:",
    invalidAuthorizeUrl:
      "Dapat sa Shopify Admin OAuth magbukas, hindi sa public storefront. Buksan ang Virello sa tamang app URL at subukan ulit ang Connect Shopify.",
  },
};

export function t(locale: AppLocale, key: CopyKey): string {
  return COPY[locale][key];
}
