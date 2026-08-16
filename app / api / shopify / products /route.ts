import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: 'Missing Shopify credentials in environment variables' },
        { status: 500 }
      );
    }

    const response = await fetch(`https://${shop}/admin/api/2024-01/products.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      cache: 'no-store', 
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: `Shopify API Error: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
