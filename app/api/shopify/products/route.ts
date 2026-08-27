import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";
const SHOPIFY_MYSHOPIFY_SUFFIX = ".myshopify.com";

function normalizeShop(value: string) {
  const raw = value.trim().toLowerCase();

  if (!raw) {
    return "";
  }

  try {
    const withProtocol = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase();

    if (
      !hostname.endsWith(SHOPIFY_MYSHOPIFY_SUFFIX) ||
      hostname === SHOPIFY_MYSHOPIFY_SUFFIX
    ) {
      return "";
    }

    return hostname;
  } catch {
    return "";
  }
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSessionToken(request: NextRequest) {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    request.headers
      .get("x-shopify-session-token")
      ?.trim() ||
    ""
  );
}

function getTokenParts(token: string) {
  const parts = token.split(".");

  if (parts.length !== 3 || parts.some((part) => !part)) {
    return null;
  }

  return {
    encodedHeader: parts[0],
    encodedPayload: parts[1],
    encodedSignature: parts[2],
  };
}

function verifyShopifySessionToken(token: string) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel."
    );
  }

  const parts = getTokenParts(token);

  if (!parts) {
    return {
      valid: false,
      shop: "",
    };
  }

  const header = decodeBase64UrlJson(parts.encodedHeader);
  const payload = decodeBase64UrlJson(parts.encodedPayload);

  if (!header || !payload) {
    return {
      valid: false,
      shop: "",
    };
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    return {
      valid: false,
      shop: "",
    };
  }

  const expectedSignature = createHmac(
    "sha256",
    apiSecret
  )
    .update(
      `${parts.encodedHeader}.${parts.encodedPayload}`
    )
    .digest();

  let receivedSignature: Buffer;

  try {
    receivedSignature = Buffer.from(
      parts.encodedSignature,
      "base64url"
    );
  } catch {
    return {
      valid: false,
      shop: "",
    };
  }

  if (
    receivedSignature.length !==
    expectedSignature.length
  ) {
    return {
      valid: false,
      shop: "",
    };
  }

  if (
    !timingSafeEqual(
      receivedSignature,
      expectedSignature
    )
  ) {
    return {
      valid: false,
      shop: "",
    };
  }

  if (payload.aud !== apiKey) {
    return {
      valid: false,
      shop: "",
    };
  }

  if (
    typeof payload.exp !== "number" ||
    typeof payload.nbf !== "number"
  ) {
    return {
      valid: false,
      shop: "",
    };
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp <= now) {
    return {
      valid: false,
      shop: "",
    };
  }

  if (payload.nbf > now + 60) {
    return {
      valid: false,
      shop: "",
    };
  }

  if (
    typeof payload.dest !== "string" ||
    typeof payload.iss !== "string"
  ) {
    return {
      valid: false,
      shop: "",
    };
  }

  let destShop = "";
  let issuerShop = "";

  try {
    const destUrl = new URL(payload.dest);
    const issuerUrl = new URL(payload.iss);

    destShop = normalizeShop(
      destUrl.hostname
    );

    issuerShop = normalizeShop(
      issuerUrl.hostname
    );

    if (!issuerUrl.pathname.startsWith("/admin")) {
      return {
        valid: false,
        shop: "",
      };
    }
  } catch {
    return {
      valid: false,
      shop: "",
    };
  }

  if (!destShop || !issuerShop || destShop !== issuerShop) {
    return {
      valid: false,
      shop: "",
    };
  }

  return {
    valid: true,
    shop: destShop,
  };
}

async function exchangeToken(
  shop: string,
  sessionToken: string
) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel."
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type:
          "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: sessionToken,
        subject_token_type:
          "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:online-access-token",
      }).toString(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Shopify token exchange returned non-JSON response (${response.status}).`
    );
  }

  const errorData = data as {
    error?: string;
    error_description?: string;
    access_token?: string;
  };

  if (!response.ok) {
    throw new Error(
      errorData.error_description ||
        errorData.error ||
        `Shopify token exchange failed (${response.status}).`
    );
  }

  if (!errorData.access_token) {
    throw new Error(
      "Shopify did not return an Admin API access token."
    );
  }

  return errorData.access_token;
}

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const sessionToken =
      getSessionToken(request);

    const cookieAccessToken =
      request.cookies.get(
        "virello_shopify_access_token"
      )?.value?.trim() || "";

    const cookieShopRaw =
      request.cookies.get(
        "virello_shopify_shop"
      )?.value?.trim() || "";

    const cookieShop =
      normalizeShop(cookieShopRaw);

    let shop = "";
    let accessToken = "";

    /*
     * If a Shopify session token is present,
     * verify it first and derive the shop from
     * the signed token. Never trust the shop
     * header over the signed token.
     */
    if (sessionToken) {
      const verified =
        verifyShopifySessionToken(
          sessionToken
        );

      if (!verified.valid || !verified.shop) {
        return errorResponse(
          "Invalid or expired Shopify session token.",
          401
        );
      }

      shop = verified.shop;

      const headerShop =
        normalizeShop(
          request.headers.get(
            "x-shopify-shop"
          ) || ""
        );

      if (
        headerShop &&
        headerShop !== shop
      ) {
        return errorResponse(
          "Shopify shop header does not match the authenticated session.",
          403
        );
      }

      /*
       * If cookies exist, they must belong to
       * the same authenticated Shopify shop.
       */
      if (
        cookieAccessToken &&
        cookieShop &&
        cookieShop !== shop
      ) {
        return errorResponse(
          "Shopify shop cookie does not match the authenticated session.",
          403
        );
      }

      /*
       * Prefer an existing access-token cookie,
       * otherwise exchange the verified session token.
       */
      if (
        cookieAccessToken &&
        cookieShop === shop
      ) {
        accessToken =
          cookieAccessToken;
      } else {
        accessToken =
          await exchangeToken(
            shop,
            sessionToken
          );
      }
    } else {
      /*
       * Cookie-only requests are accepted only
       * when BOTH cookies are present and the
       * shop cookie is a valid myshopify domain.
       */
      if (
        !cookieAccessToken ||
        !cookieShop
      ) {
        return errorResponse(
          "Shopify connection is missing.",
          401
        );
      }

      shop = cookieShop;
      accessToken =
        cookieAccessToken;
    }

    const body = await request.json();

    const {
      productId,
      title,
      description,
      productType,
      tags,
      seoTitle,
      metaDescription,
    } = body ?? {};

    if (
      typeof productId !== "string" ||
      !productId.trim()
    ) {
      return errorResponse(
        "Product ID is required.",
        400
      );
    }

    const input: Record<string, unknown> = {
      id: productId.trim(),
    };

    if (typeof title === "string") {
      input.title = title.trim();
    }

    if (typeof description === "string") {
      input.descriptionHtml = description;
    }

    if (typeof productType === "string") {
      input.productType =
        productType.trim();
    }

    if (Array.isArray(tags)) {
      input.tags = tags
        .filter(
          (tag): tag is string =>
            typeof tag === "string"
        )
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else if (typeof tags === "string") {
      input.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    const seo: Record<string, string> = {};

    if (typeof seoTitle === "string") {
      seo.title = seoTitle.trim();
    }

    if (
      typeof metaDescription === "string"
    ) {
      seo.description =
        metaDescription.trim();
    }

    if (Object.keys(seo).length > 0) {
      input.seo = seo;
    }

    const mutation = `
      mutation UpdateProduct(
        $input: ProductInput!
      ) {
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

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "X-Shopify-Access-Token":
            accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            input,
          },
        }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Shopify returned a non-JSON response (${response.status}).`
      );
    }

    const responseData = data as {
      errors?: Array<{
        message?: string;
      }>;
      data?: {
        productUpdate?: {
          product?: unknown;
          userErrors?: Array<{
            field?: string[];
            message?: string;
          }>;
        };
      };
    };

    if (!response.ok) {
      throw new Error(
        responseData.errors?.[0]
          ?.message ||
          `Shopify API request failed (${response.status}).`
      );
    }

    if (
      responseData.errors?.length
    ) {
      throw new Error(
        responseData.errors
          .map(
            (error) =>
              error.message ||
              "Shopify GraphQL error."
          )
          .join("; ")
      );
    }

    const result =
      responseData.data
        ?.productUpdate;

    if (!result) {
      throw new Error(
        "Shopify did not return a product update result."
      );
    }

    if (
      result.userErrors?.length
    ) {
      throw new Error(
        result.userErrors
          .map(
            (error) =>
              error.message ||
              "Shopify product update failed."
          )
          .join("; ")
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Product saved to Shopify successfully.",
        product: result.product,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "SHOPIFY_SAVE_PRODUCT_ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to save product to Shopify.",
      500
    );
  }
}
