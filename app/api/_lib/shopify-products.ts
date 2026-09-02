import { shopifyAdminGraphql, SHOPIFY_PRODUCT_PAGE_SIZE } from "./shopify-admin";
import { hasRequiredShopifyScopes } from "./shopify-scopes";
import { storedShopifyScope } from "./shopify-auth";

export class ShopifyProductError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ShopifyProductError";
    this.status = status;
  }
}

export type ImportedProduct = {
  id: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  price: string;
  status: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  handle: string;
  options: string[];
  variants: string[];
};

export type ProductPage = {
  products: ImportedProduct[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  shop: string;
};

const LIST_QUERY = `
  query ImportProducts($first: Int!, $cursor: String) {
    products(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        descriptionHtml
        productType
        vendor
        status
        tags
        seo {
          title
          description
        }
        handle
        options {
          name
          values
        }
        variants(first: 8) {
          nodes {
            title
            price
            sku
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateProduct($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        descriptionHtml
        productType
        tags
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function assertWritableShopifyScopes(shop: string): Promise<void> {
  const scope = await storedShopifyScope(shop);
  if (!hasRequiredShopifyScopes(scope)) {
    throw new ShopifyProductError(
      "Shopify app is missing product permissions. Reconnect the store and approve read_products and write_products.",
      403
    );
  }
}

export async function importProductPage(
  shop: string,
  accessToken: string,
  cursor = ""
): Promise<ProductPage> {
  await assertWritableShopifyScopes(shop);
  const data = await shopifyAdminGraphql<{
    products?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      nodes?: Array<{
        id?: string;
        title?: string;
        descriptionHtml?: string;
        productType?: string;
        vendor?: string;
        status?: string;
        tags?: string[];
        seo?: { title?: string | null; description?: string | null };
        handle?: string;
        options?: Array<{ name?: string; values?: string[] }>;
        variants?: {
          nodes?: Array<{
            title?: string;
            price?: string;
            sku?: string;
            selectedOptions?: Array<{ name?: string; value?: string }>;
          }>;
        };
      }>;
    };
  }>(shop, accessToken, LIST_QUERY, {
    first: SHOPIFY_PRODUCT_PAGE_SIZE,
    cursor: cursor || null,
  });

  const nodes = data.products?.nodes || [];
  const products = nodes
    .filter((product): product is typeof product & { id: string } => Boolean(product.id))
    .map((product) => ({
      id: product.id,
      title: product.title || "",
      description: product.descriptionHtml || "",
      productType: product.productType || "",
      vendor: product.vendor || "",
      price: product.variants?.nodes?.[0]?.price || "",
      status: product.status || "",
      tags: Array.isArray(product.tags) ? product.tags : [],
      seoTitle: product.seo?.title || "",
      seoDescription: product.seo?.description || "",
      handle: product.handle || "",
      options: (product.options || [])
        .map((option) => {
          const values = Array.isArray(option.values) ? option.values.filter(Boolean).join(", ") : "";
          return [option.name, values].filter(Boolean).join(": ");
        })
        .filter(Boolean),
      variants: (product.variants?.nodes || [])
        .map((variant) => {
          const options = (variant.selectedOptions || [])
            .map((option) => [option.name, option.value].filter(Boolean).join(" "))
            .filter(Boolean)
            .join(", ");
          return [variant.title, options, variant.price, variant.sku].filter(Boolean).join(" · ");
        })
        .filter(Boolean),
    }));

  return {
    shop,
    products,
    pageInfo: {
      hasNextPage: Boolean(data.products?.pageInfo?.hasNextPage),
      endCursor: data.products?.pageInfo?.endCursor || null,
    },
  };
}

export type SaveProductInput = {
  productId: string;
  title?: string;
  description?: string;
  productType?: string;
  tags?: string[] | string;
  seoTitle?: string;
  seoDescription?: string;
  confirmed?: boolean;
};

export function parseSaveProductInput(body: unknown): SaveProductInput {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawId = typeof data.productId === "string" ? data.productId.trim() : "";
  const productId = /^\d+$/.test(rawId)
    ? `gid://shopify/Product/${rawId}`
    : rawId;
  if (!productId || !/^gid:\/\/shopify\/Product\/\d+$/i.test(productId)) {
    throw new ShopifyProductError("Product ID is required.");
  }
  return {
    productId,
    title: typeof data.title === "string" ? data.title : undefined,
    description: typeof data.description === "string" ? data.description : undefined,
    productType: typeof data.productType === "string" ? data.productType : undefined,
    tags: Array.isArray(data.tags) || typeof data.tags === "string" ? data.tags as string[] | string : undefined,
    seoTitle: typeof data.seoTitle === "string" ? data.seoTitle : undefined,
    seoDescription:
      typeof data.seoDescription === "string"
        ? data.seoDescription
        : typeof data.metaDescription === "string"
          ? data.metaDescription
          : undefined,
    confirmed: data.confirmed === true,
  };
}

export async function saveReviewedProduct(
  shop: string,
  accessToken: string,
  input: SaveProductInput
): Promise<unknown> {
  await assertWritableShopifyScopes(shop);
  if (input.confirmed !== true) {
    throw new ShopifyProductError(
      "Review and approve the product changes before saving them to Shopify."
    );
  }

  const productInput: Record<string, unknown> = { id: input.productId };
  if (typeof input.title === "string") productInput.title = input.title.trim();
  if (typeof input.description === "string") productInput.descriptionHtml = input.description;
  if (typeof input.productType === "string") productInput.productType = input.productType.trim();
  if (Array.isArray(input.tags)) {
    productInput.tags = input.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  } else if (typeof input.tags === "string") {
    productInput.tags = input.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  const seo: Record<string, string> = {};
  if (typeof input.seoTitle === "string") seo.title = input.seoTitle.trim();
  if (typeof input.seoDescription === "string") seo.description = input.seoDescription.trim();
  if (Object.keys(seo).length) productInput.seo = seo;

  const data = await shopifyAdminGraphql<{
    productUpdate?: {
      product?: unknown;
      userErrors?: Array<{ message?: string }>;
    };
  }>(shop, accessToken, UPDATE_MUTATION, { input: productInput });

  const result = data.productUpdate;
  if (!result) {
    throw new ShopifyProductError("Shopify did not return a product update result.", 502);
  }
  if (result.userErrors?.length) {
    throw new ShopifyProductError(
      result.userErrors.map((error) => error.message || "Shopify product update failed.").join("; "),
      400
    );
  }
  return result.product;
}
