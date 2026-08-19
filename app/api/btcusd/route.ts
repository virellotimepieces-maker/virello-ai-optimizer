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

    if (change >= 0) gains += change;
    else losses += Math.abs(change);
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
): "BULLISH" | "BEARISH" | "NEUTRAL" {
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

function detectElliottWave(
  closes: number[],
): {
  wave: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
} {
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
    if (recent[i] > recent[i - 1]) rising++;
    if (recent[i] < recent[i - 1]) falling++;
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

export async function GET() {
  try {
    const intervals = ["15m", "1h", "4h"];

    const timeframeResults: Record<
      string,
      any
    > = {};

    for (const interval of intervals) {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=250`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Binance request failed for ${interval}`,
        );
      }

      const candles =
        (await response.json()) as Candle[];

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

    let signal:
      | "LONG"
      | "SHORT"
      | "WAIT" = "WAIT";

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
    const risk = primary.atr14 || entry * 0.01;

    let stopLoss = entry;
    let takeProfit1 = entry;
    let takeProfit2 = entry;

    if (signal === "LONG") {
      stopLoss = entry - risk * 1.5;
      takeProfit1 = entry + risk * 2;
      takeProfit2 = entry + risk * 3;
    }

    if (signal === "SHORT") {
      stopLoss = entry + risk * 1.5;
      takeProfit1 = entry - risk * 2;
      takeProfit2 = entry - risk * 3;
    }

    return NextResponse.json({
      success: true,

      symbol: "BTCUSDT",

      generatedAt:
        new Date().toISOString(),

      signal,

      confidence,

      timeframes: timeframeResults,

      tradePlan: {
        entry: round(entry),
        stopLoss: round(stopLoss),
        takeProfit1: round(takeProfit1),
        takeProfit2: round(takeProfit2),
      },

      elliottWave: primary.elliottWave,

      liquidationHeatmap: {
        status: "provider_not_configured",
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
        trend: primary.trend,
        rsi: primary.rsi14,
        support: primary.support,
        resistance: primary.resistance,
        ema20: primary.ema20,
        ema50: primary.ema50,
        ema200: primary.ema200,
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
