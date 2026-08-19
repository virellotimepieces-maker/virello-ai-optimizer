import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Candle = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

type Trend = "BULLISH" | "BEARISH" | "NEUTRAL";
type Signal = "LONG" | "SHORT" | "WAIT";

type ElliottWave = {
  wave: string;
  bias: Trend;
  confidence: number;
};

type Timeframe = {
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  support: number;
  resistance: number;
  trend: Trend;
  elliottWave: ElliottWave;
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function ema(values: number[], period: number): number {
  if (values.length < period) return 0;

  const multiplier = 2 / (period + 1);

  let result =
    values
      .slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i++) {
    result =
      (values[i] - result) * multiplier + result;
  }

  return result;
}

function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain =
      (avgGain * (period - 1) + gain) / period;

    avgLoss =
      (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;

  return 100 - 100 / (1 + rs);
}

function atr(
  candles: Candle[],
  period = 14,
): number {
  if (candles.length <= period) return 0;

  const ranges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = Number(candles[i][2]);
    const low = Number(candles[i][3]);
    const previousClose = Number(candles[i - 1][4]);

    ranges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  const recent = ranges.slice(-period);

  if (!recent.length) return 0;

  return (
    recent.reduce((a, b) => a + b, 0) /
    recent.length
  );
}

function supportResistance(
  candles: Candle[],
) {
  const recent = candles.slice(-50);

  return {
    support: Math.min(
      ...recent.map((c) => Number(c[3])),
    ),
    resistance: Math.max(
      ...recent.map((c) => Number(c[2])),
    ),
  };
}

function detectTrend(
  price: number,
  ema20: number,
  ema50: number,
  ema200: number,
): Trend {
  if (
    price > ema20 &&
    ema20 > ema50 &&
    ema50 > ema200
  ) {
    return "BULLISH";
  }

  if (
    price < ema20 &&
    ema20 < ema50 &&
    ema50 < ema200
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

async function fetchBinance(
  interval: string,
): Promise<Candle[]> {
  const url =
    `https://data-api.binance.vision/api/v3/klines` +
    `?symbol=BTCUSDT` +
    `&interval=${interval}` +
    `&limit=250`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Live Binance data failed for ${interval}: HTTP ${response.status}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length < 200) {
    throw new Error(
      `Insufficient live Binance data for ${interval}.`,
    );
  }

  return data as Candle[];
}

/**
 * CoinGlass LIVE liquidation heatmap.
 *
 * Requires:
 * COINGLASS_API_KEY
 *
 * No liquidation values are generated locally.
 */
async function fetchCoinGlassHeatmap() {
  const apiKey =
    process.env.COINGLASS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "COINGLASS_API_KEY is missing in Vercel Environment Variables.",
    );
  }

  const url =
    "https://open-api-v4.coinglass.com/api/futures/liquidation/heatmap/model1" +
    "?symbol=BTCUSDT" +
    "&exchange=Binance" +
    "&interval=1h";

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "CG-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Live CoinGlass liquidation heatmap failed: HTTP ${response.status}`,
    );
  }

  const data = await response.json();

  if (!data) {
    throw new Error(
      "CoinGlass returned empty liquidation heatmap data.",
    );
  }

  return data;
}

/**
 * Signa LIVE Elliott Wave.
 *
 * Requires:
 * SIGNA_API_KEY
 *
 * The exact response is preserved so the frontend
 * can consume the provider's live Elliott analysis.
 */
async function fetchSignaElliottWave() {
  const apiKey =
    process.env.SIGNA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SIGNA_API_KEY is missing in Vercel Environment Variables.",
    );
  }

  const response = await fetch(
    "https://api.getsigna.ai/v1/signals/BTCUSD",
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Live Signa Elliott Wave request failed: HTTP ${response.status}`,
    );
  }

  const data = await response.json();

  if (!data) {
    throw new Error(
      "Signa returned empty Elliott Wave data.",
    );
  }

  return data;
}

function buildLocalTimeframe(
  candles: Candle[],
): Timeframe {
  const closes = candles.map((c) =>
    Number(c[4]),
  );

  const price =
    closes[closes.length - 1];

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);

  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);

  const levels =
    supportResistance(candles);

  const trend = detectTrend(
    price,
    ema20,
    ema50,
    ema200,
  );

  return {
    price: round(price),
    ema20: round(ema20),
    ema50: round(ema50),
    ema200: round(ema200),
    rsi14: round(rsi14),
    atr14: round(atr14),
    support: round(levels.support),
    resistance: round(levels.resistance),
    trend,
    elliottWave: {
      wave: "LIVE_PROVIDER_DATA",
      bias: "NEUTRAL",
      confidence: 0,
    },
  };
}

export async function GET() {
  try {
    /*
     * LIVE BINANCE MARKET DATA
     */
    const intervals = [
      "15m",
      "1h",
      "4h",
    ];

    const timeframes:
      Record<string, Timeframe> = {};

    for (const interval of intervals) {
      const candles =
        await fetchBinance(interval);

      timeframes[interval] =
        buildLocalTimeframe(candles);
    }

    /*
     * LIVE ELLIOTT WAVE PROVIDER
     */
    const elliottWave =
      await fetchSignaElliottWave();

    /*
     * LIVE LIQUIDATION HEATMAP
     */
    const liquidationHeatmap =
      await fetchCoinGlassHeatmap();

    const primary =
      timeframes["1h"];

    /*
     * Signal is intentionally conservative.
     * It is based on live Binance indicators.
     */
    let signal: Signal = "WAIT";
    let confidence = 50;

    if (
      primary.trend === "BULLISH" &&
      primary.rsi14 >= 45 &&
      primary.rsi14 <= 70
    ) {
      signal = "LONG";
      confidence = 68;
    }

    if (
      primary.trend === "BEARISH" &&
      primary.rsi14 >= 30 &&
      primary.rsi14 <= 55
    ) {
      signal = "SHORT";
      confidence = 68;
    }

    const entry =
      primary.price;

    const risk =
      primary.atr14 > 0
        ? primary.atr14
        : entry * 0.01;

    let stopLoss = entry;
    let takeProfit1 = entry;
    let takeProfit2 = entry;

    if (signal === "LONG") {
      stopLoss =
        entry - risk * 1.5;

      takeProfit1 =
        entry + risk * 2;

      takeProfit2 =
        entry + risk * 3;
    }

    if (signal === "SHORT") {
      stopLoss =
        entry + risk * 1.5;

      takeProfit1 =
        entry - risk * 2;

      takeProfit2 =
        entry - risk * 3;
    }

    return NextResponse.json({
      success: true,

      symbol: "BTCUSDT",

      generatedAt:
        new Date().toISOString(),

      signal,

      confidence,

      timeframes,

      tradePlan: {
        entry: round(entry),
        stopLoss: round(stopLoss),
        takeProfit1:
          round(takeProfit1),
        takeProfit2:
          round(takeProfit2),
      },

      elliottWave,

      liquidationHeatmap,

      riskManagement: {
        riskPerTrade:
          "Use a predefined percentage of account equity.",

        stopLossRequired: true,

        leverage:
          "Avoid excessive leverage.",
      },

      analysis: {
        trend:
          primary.trend,

        rsi:
          primary.rsi14,

        support:
          primary.support,

        resistance:
          primary.resistance,

        ema20:
          primary.ema20,

        ema50:
          primary.ema50,

        ema200:
          primary.ema200,
      },
    });
  } catch (error) {
    console.error(
      "BTCUSD live analysis error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "BTCUSD live analysis failed.",
      },
      {
        status: 500,
      },
    );
  }
}
