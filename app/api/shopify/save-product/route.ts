import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_API_VERSION = "2026-07";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/(\.myshopify\.com){2,}$/, ".myshopify.com");
}

function isValidShopDomain(value: string) {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(value);
}

function resolveShopDomain(value: string) {
  const shop = cleanShopDomain(value);

  return isValidShopDomain(shop) ? shop : "";
}

function getToken(request: NextRequest) {
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

function getShop(request: NextRequest, token: string) {
  const headerShop = resolveShopDomain(
    request.headers
      .get("x-shopify-shop")
      ?.trim() || ""
  );

  if (headerShop) {
    return headerShop;
  }

  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    if (typeof payload.dest !== "string") {
      return "";
    }

    return resolveShopDomain(
      new URL(payload.dest).hostname
    );
  } catch {
    return "";
  }
}

async function exchangeToken(
  shop: string,
  idToken: string
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
        subject_token: idToken,
        subject_token_type:
          "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:online-access-token",
      }).toString(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Shopify token exchange returned non-JSON response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        data?.errors?.[0]?.message ||
        `Shopify token exchange failed (${response.status}).`
    );
  }

  if (!data?.access_token) {
    throw new Error(
      "Shopify did not return an Admin API access token."
    );
  }

  return data.access_token as string;
}

export async function POST(request: NextRequest) {
  try {
    const idToken = getToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify session token is missing. Open Virello from Shopify Admin.",
        },
        { status: 401 }
      );
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
    } = body;

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const shop = getShop(request, idToken);

    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify store could not be determined.",
        },
        { status: 400 }
      );
    }

    const accessToken = await exchangeToken(
      shop,
      idToken
    );

    const tagList = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags
            .split(",")
            .map((tag: string) => tag.trim())
            .filter(Boolean)
        : [];

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

    const variables = {
      input: {
        id: productId,
        title:
          typeof title === "string"
            ? title.trim()
            : undefined,
        descriptionHtml:
          typeof description === "string"
            ? description
            : undefined,
        productType:
          typeof productType === "string"
            ? productType.trim()
            : undefined,
        tags: tagList,
        seo: {
          title:
            typeof seoTitle === "string"
              ? seoTitle.trim()
              : undefined,
          description:
            typeof metaDescription === "string"
              ? metaDescription.trim()
              : undefined,
        },
      },
    };

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Shopify returned a non-JSON response (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.errors?.[0]?.message ||
          `Shopify API request failed (${response.status}).`
      );
    }

    if (data?.errors?.length) {
      throw new Error(
        data.errors
          .map((error: any) => error.message)
          .join("; ")
      );
    }

    const result =
      data?.data?.productUpdate;

    if (!result) {
      throw new Error(
        "Shopify did not return a product update result."
      );
    }

    if (result.userErrors?.length) {
      throw new Error(
        result.userErrors
          .map(
            (error: any) =>
              error.message
          )
          .join("; ")
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Product saved to Shopify successfully.",
      product: result.product,
    });
  } catch (error) {
    console.error(
      "SHOPIFY_SAVE_PRODUCT_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save product to Shopify.",
      },
      { status: 500 }
    );
  }
}
