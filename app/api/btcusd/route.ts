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

    const trueRange = Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose),
    );

    ranges.push(trueRange);
  }

  const recent = ranges.slice(-period);

  if (recent.length === 0) return 0;

  return (
    recent.reduce((a, b) => a + b, 0) /
    recent.length
  );
}

function supportResistance(
  candles: Candle[],
): {
  support: number;
  resistance: number;
} {
  const recent = candles.slice(-50);

  const lows = recent.map((c) => Number(c[3]));
  const highs = recent.map((c) => Number(c[2]));

  return {
    support: Math.min(...lows),
    resistance: Math.max(...highs),
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

/**
 * This is a heuristic Elliott Wave interpretation.
 * It does NOT claim to mathematically prove a wave count.
 */
function detectElliottWave(
  closes: number[],
): ElliottWave {
  if (closes.length < 20) {
    return {
      wave: "Insufficient data",
      bias: "NEUTRAL",
      confidence: 0,
    };
  }

  const recent = closes.slice(-20);

  let rising = 0;
  let falling = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) {
      rising++;
    }

    if (recent[i] < recent[i - 1]) {
      falling++;
    }
  }

  if (rising >= 14) {
    return {
      wave: "Possible bullish impulse",
      bias: "BULLISH",
      confidence: 65,
    };
  }

  if (falling >= 14) {
    return {
      wave: "Possible bearish impulse",
      bias: "BEARISH",
      confidence: 65,
    };
  }

  return {
    wave: "Possible corrective / mixed structure",
    bias: "NEUTRAL",
    confidence: 45,
  };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Binance can reject or throttle a particular public endpoint.
 * We therefore try several public market-data endpoints.
 */
const BINANCE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

async function fetchBinanceCandles(
  interval: string,
): Promise<Candle[]> {
  let lastError =
    `Unable to load Binance ${interval} data.`;

  for (const host of BINANCE_HOSTS) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      const url =
        `${host}/api/v3/klines` +
        `?symbol=BTCUSDT` +
        `&interval=${encodeURIComponent(interval)}` +
        `&limit=250`;

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError =
          `Binance ${host} returned HTTP ${response.status} for ${interval}.`;

        continue;
      }

      const json = await response.json();

      if (!Array.isArray(json) || json.length < 200) {
        lastError =
          `Binance returned insufficient ${interval} candle data.`;

        continue;
      }

      return json as Candle[];
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : `Binance ${host} request failed for ${interval}.`;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

export async function GET() {
  try {
    const intervals = ["15m", "1h", "4h"];

    const timeframeResults: Record<
      string,
      Timeframe
    > = {};

    for (const interval of intervals) {
      const candles =
        await fetchBinanceCandles(interval);

      const closes = candles.map((c) =>
        Number(c[4]),
      );

      if (closes.length < 200) {
        throw new Error(
          `Insufficient BTCUSDT data for ${interval}.`,
        );
      }

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

      const wave =
        detectElliottWave(closes);

      timeframeResults[interval] = {
        price: round(price),
        ema20: round(ema20),
        ema50: round(ema50),
        ema200: round(ema200),
        rsi14: round(rsi14),
        atr14: round(atr14),
        support: round(levels.support),
        resistance: round(levels.resistance),
        trend,
        elliottWave: wave,
      };
    }

    const primary =
      timeframeResults["1h"];

    let signal: Signal = "WAIT";
    let confidence = 50;

    if (
      primary.trend === "BULLISH" &&
      primary.rsi14 >= 45 &&
      primary.rsi14 <= 70 &&
      primary.elliottWave.bias === "BULLISH"
    ) {
      signal = "LONG";
      confidence = 72;
    } else if (
      primary.trend === "BEARISH" &&
      primary.rsi14 >= 30 &&
      primary.rsi14 <= 55 &&
      primary.elliottWave.bias === "BEARISH"
    ) {
      signal = "SHORT";
      confidence = 72;
    }

    const entry = primary.price;

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

      timeframes:
        timeframeResults,

      tradePlan: {
        entry: round(entry),
        stopLoss: round(stopLoss),
        takeProfit1: round(takeProfit1),
        takeProfit2: round(takeProfit2),
      },

      elliottWave:
        primary.elliottWave,

      liquidationHeatmap: {
        status:
          "provider_not_configured",

        message:
          "Liquidation heatmap data is not connected yet. No liquidation levels are being invented.",
      },

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
      "BTCUSD analysis error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "BTCUSD analysis failed.",
      },
      {
        status: 500,
      },
    );
  }
}
