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
  | "invalidAuthorizeUrl"
  | "changeStore"
  | "changeStoreConfirm"
  | "pendingStore"
  | "disconnectSuccess"
  | "alreadyLinkedInstalled"
  | "benefitBullets"
  | "targetCustomer"
  | "purchaseMotivation"
  | "strongestFeatures"
  | "weaknesses"
  | "missingInformation"
  | "objections"
  | "conversionOpportunities"
  | "keywords"
  | "callToAction"
  | "warnings"
  | "seoTitle"
  | "seoDescription"
  | "tagsLabel"
  | "conversionCopy"
  | "reviewHint"
  | "oauthCancelled"
  | "oauthUnauthorizedHelp"
  | "fieldTitle"
  | "fieldDescription"
  | "onePerLine"
  | "objectionResponse";

export const COPY: Record<AppLocale, Record<CopyKey, string>> = {
  en: {
    brandSmall: "VIRELLO AI",
    brand: "Virello AI Optimizer",
    eyebrow: "SHOPIFY PRODUCT OPTIMIZER",
    headline: "Optimize Shopify products with AI.",
    subhead:
      "Subscribe, connect your store, import products, review AI title, benefits, SEO and tags, then save to Shopify.",
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
    emptyReview: "Optimize a product to review title, description, benefits, SEO, tags, and conversion copy.",
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
      "Shopify authorization must open {shop}.myshopify.com/admin/oauth/authorize, not the public storefront. Try Connect Shopify again.",
    changeStore: "Change Store",
    changeStoreConfirm:
      "Disconnect the installed Shopify store? Stripe billing is kept. You will need to authorize the new store.",
    pendingStore: "Pending store",
    disconnectSuccess:
      "Shopify store disconnected. Connect a new .myshopify.com domain. Your Stripe subscription stays on this session.",
    alreadyLinkedInstalled:
      "This Virello session is already linked to a connected Shopify store. Use Change Store to disconnect it first.",
    benefitBullets: "Customer-benefit bullets",
    targetCustomer: "Target customer",
    purchaseMotivation: "Purchase motivation",
    strongestFeatures: "Features as customer benefits",
    weaknesses: "Weaknesses and gaps",
    missingInformation: "Missing product information",
    objections: "Customer objections",
    conversionOpportunities: "Conversion opportunities",
    keywords: "Keywords",
    callToAction: "Call to action",
    warnings: "Warnings",
    seoTitle: "SEO title",
    seoDescription: "SEO meta description",
    tagsLabel: "Shopify tags",
    conversionCopy: "Conversion summary",
    reviewHint:
      "Edit every field. Nothing is published until you approve and click Save to Shopify.",
    oauthCancelled:
      "Shopify authorization was cancelled or did not complete. The store is still disconnected.",
    oauthUnauthorizedHelp:
      "Shopify rejected the install (Unauthorized Access). In Shopify Dev Dashboard → Apps → this Virello app → Versions → Create a version, set Use legacy install flow to True. App URL: https://virello-ai-optimizer.vercel.app. Allowed redirection URL(s): https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback. Then click Release. Install while logged into gfd1cp-1y.myshopify.com as staff who can install apps.",
    fieldTitle: "Product title",
    fieldDescription: "Product description",
    onePerLine: "One item per line",
    objectionResponse: "Honest response",
  },
  fil: {
    brandSmall: "VIRELLO AI",
    brand: "Virello AI Optimizer",
    eyebrow: "SHOPIFY PRODUCT OPTIMIZER",
    headline: "I-optimize ang Shopify products gamit ang AI.",
    subhead:
      "Mag-subscribe, ikonekta ang store, mag-import ng products, i-review ang AI title, benefits, SEO at tags, tapos i-save sa Shopify.",
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
    emptyReview: "Mag-optimize muna ng product para ma-review ang title, description, benefits, SEO, tags, at conversion copy.",
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
      "Dapat sa {shop}.myshopify.com/admin/oauth/authorize magbukas, hindi sa public storefront. Subukan ulit ang Connect Shopify.",
    changeStore: "Palitan ang store",
    changeStoreConfirm:
      "I-disconnect ang naka-install na Shopify store? Mananatili ang Stripe billing. Kailangan i-authorize ulit ang bagong store.",
    pendingStore: "Pending store",
    disconnectSuccess:
      "Na-disconnect ang Shopify store. Ikonekta ang bagong .myshopify.com domain. Mananatili ang Stripe subscription sa session na ito.",
    alreadyLinkedInstalled:
      "Naka-link na ang Virello session na ito sa ibang naka-connect na Shopify store. Gamitin muna ang Palitan ang store.",
    benefitBullets: "Mga customer-benefit bullet",
    targetCustomer: "Target customer",
    purchaseMotivation: "Dahilan ng pagbili",
    strongestFeatures: "Mga feature bilang customer benefit",
    weaknesses: "Mga kahinaan at kulang",
    missingInformation: "Kulang na product information",
    objections: "Mga objection ng customer",
    conversionOpportunities: "Mga conversion opportunity",
    keywords: "Mga keyword",
    callToAction: "Call to action",
    warnings: "Mga babala",
    seoTitle: "SEO title",
    seoDescription: "SEO meta description",
    tagsLabel: "Mga Shopify tag",
    conversionCopy: "Conversion summary",
    reviewHint:
      "I-edit ang bawat field. Walang nase-save sa Shopify hangga't hindi ka nag-approve at nag-click ng Save to Shopify.",
    oauthCancelled:
      "Nakansela o hindi natapos ang Shopify authorization. Hindi pa nakakonekta ang store.",
    oauthUnauthorizedHelp:
      "Tinanggihan ng Shopify ang install (Unauthorized Access). Sa Shopify Dev Dashboard → Apps → Virello app → Versions → Create a version, i-set ang Use legacy install flow sa True. App URL: https://virello-ai-optimizer.vercel.app. Allowed redirection URL(s): https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback. I-click ang Release. Mag-install habang naka-login sa gfd1cp-1y.myshopify.com bilang staff na pwedeng mag-install ng app.",
    fieldTitle: "Product title",
    fieldDescription: "Product description",
    onePerLine: "Isang item bawat line",
    objectionResponse: "Tapat na sagot",
  },
};

export function t(locale: AppLocale, key: CopyKey): string {
  return COPY[locale][key];
}
