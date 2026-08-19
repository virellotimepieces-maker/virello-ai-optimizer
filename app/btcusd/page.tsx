"use client";

import { useEffect, useState } from "react";

type Trend = "BULLISH" | "BEARISH" | "NEUTRAL";
type Signal = "LONG" | "SHORT" | "WAIT";

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
  elliottWave: {
    wave: string;
    bias: Trend;
    confidence: number;
  };
};

type BTCResponse = {
  success: boolean;
  symbol: string;
  generatedAt: string;
  signal: Signal;
  confidence: number;

  timeframes: {
    "15m": Timeframe;
    "1h": Timeframe;
    "4h": Timeframe;
  };

  tradePlan: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
  };

  elliottWave: unknown;
  liquidationHeatmap: unknown;

  riskManagement?: {
    riskPerTrade?: string;
    stopLossRequired?: boolean;
    leverage?: string;
  };

  analysis?: {
    trend?: Trend;
    rsi?: number;
    support?: number;
    resistance?: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
  };

  error?: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function signalClass(signal: Signal): string {
  if (signal === "LONG") {
    return "long";
  }

  if (signal === "SHORT") {
    return "short";
  }

  return "wait";
}

function trendClass(trend: Trend): string {
  if (trend === "BULLISH") {
    return "bullish";
  }

  if (trend === "BEARISH") {
    return "bearish";
  }

  return "neutral";
}

function TimeframeCard({
  name,
  data,
}: {
  name: string;
  data: Timeframe;
}) {
  return (
    <div className="timeframe-card">
      <div className="timeframe-title">
        import { redirect } from "next/navigation";

export default function Home() {
  redirect("/btcusd");
}
      </div>

      <div className="price">
        {money(data.price)}
      </div>

      <div className={`trend ${trendClass(data.trend)}`}>
        {data.trend}
      </div>

      <div className="stats">
        <div>
          <span>EMA 20</span>
          <strong>{number(data.ema20)}</strong>
        </div>

        <div>
          <span>EMA 50</span>
          <strong>{number(data.ema50)}</strong>
        </div>

        <div>
          <span>EMA 200</span>
          <strong>{number(data.ema200)}</strong>
        </div>

        <div>
          <span>RSI 14</span>
          <strong>{number(data.rsi14)}</strong>
        </div>

        <div>
          <span>ATR 14</span>
          <strong>{number(data.atr14)}</strong>
        </div>

        <div>
          <span>Support</span>
          <strong>{money(data.support)}</strong>
        </div>

        <div>
          <span>Resistance</span>
          <strong>{money(data.resistance)}</strong>
        </div>

        <div>
          <span>Elliott</span>
          <strong>{data.elliottWave.wave}</strong>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [data, setData] =
    useState<BTCResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadBTC = async () => {
    try {
      setError("");

      const response = await fetch(
        "/api/btcusd",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as BTCResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "BTCUSD live analysis failed.",
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load live BTCUSD data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBTC();

    const interval =
      window.setInterval(() => {
        void loadBTC();
      }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="dashboard">
      <div className="container">
        <header className="header">
          <div>
            <h1>BTCUSD Live Analysis</h1>

            <p>
              Live market analysis using real
              market data. No simulated trading
              data.
            </p>
          </div>

          <button
            onClick={() => void loadBTC()}
            disabled={loading}
            className="refresh"
          >
            {loading
              ? "Updating..."
              : "Refresh"}
          </button>
        </header>

        {error && (
          <div className="error">
            <strong>Live data error</strong>
            <div>{error}</div>
          </div>
        )}

        {loading && !data && (
          <div className="loading">
            Loading live BTCUSD analysis...
          </div>
        )}

        {data && (
          <>
            <section className="hero">
              <div>
                <div className="label">
                  BTCUSDT LIVE PRICE
                </div>

                <div className="hero-price">
                  {money(
                    data.timeframes["1h"].price,
                  )}
                </div>

                <div
                  className={`signal ${signalClass(
                    data.signal,
                  )}`}
                >
                  {data.signal}
                </div>
              </div>

              <div className="confidence">
                <span>Confidence</span>
                <strong>
                  {data.confidence}%
                </strong>
              </div>
            </section>

            <section className="timeframes">
              <TimeframeCard
                name="15M"
                data={data.timeframes["15m"]}
              />

              <TimeframeCard
                name="1H"
                data={data.timeframes["1h"]}
              />

              <TimeframeCard
                name="4H"
                data={data.timeframes["4h"]}
              />
            </section>

            <section className="trade-plan">
              <h2>Trade Plan</h2>

              <div className="trade-grid">
                <div>
                  <span>Entry</span>
                  <strong>
                    {money(
                      data.tradePlan.entry,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Stop Loss</span>
                  <strong>
                    {money(
                      data.tradePlan.stopLoss,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Take Profit 1</span>
                  <strong>
                    {money(
                      data.tradePlan
                        .takeProfit1,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Take Profit 2</span>
                  <strong>
                    {money(
                      data.tradePlan
                        .takeProfit2,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="analysis">
              <h2>Market Analysis</h2>

              <div className="analysis-grid">
                <div>
                  <span>Trend</span>
                  <strong>
                    {data.analysis?.trend ||
                      data.timeframes["1h"]
                        .trend}
                  </strong>
                </div>

                <div>
                  <span>RSI</span>
                  <strong>
                    {number(
                      data.analysis?.rsi ??
                        data.timeframes["1h"]
                          .rsi14,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Support</span>
                  <strong>
                    {money(
                      data.analysis
                        ?.support ??
                        data.timeframes["1h"]
                          .support,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Resistance</span>
                  <strong>
                    {money(
                      data.analysis
                        ?.resistance ??
                        data.timeframes["1h"]
                          .resistance,
                    )}
                  </strong>
                </div>

                <div>
                  <span>EMA 20</span>
                  <strong>
                    {number(
                      data.analysis?.ema20 ??
                        data.timeframes["1h"]
                          .ema20,
                    )}
                  </strong>
                </div>

                <div>
                  <span>EMA 50</span>
                  <strong>
                    {number(
                      data.analysis?.ema50 ??
                        data.timeframes["1h"]
                          .ema50,
                    )}
                  </strong>
                </div>

                <div>
                  <span>EMA 200</span>
                  <strong>
                    {number(
                      data.analysis?.ema200 ??
                        data.timeframes["1h"]
                          .ema200,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="live-sources">
              <div>
                <h2>Elliott Wave</h2>

                <p>
                  Live provider response is
                  connected through the server.
                </p>

                <pre>
                  {JSON.stringify(
                    data.elliottWave,
                    null,
                    2,
                  )}
                </pre>
              </div>

              <div>
                <h2>Liquidation Heatmap</h2>

                <p>
                  Live CoinGlass response is
                  connected through the server.
                </p>

                <pre>
                  {JSON.stringify(
                    data.liquidationHeatmap,
                    null,
                    2,
                  )}
                </pre>
              </div>
            </section>

            <footer>
              Last update:{" "}
              {new Date(
                data.generatedAt,
              ).toLocaleString()}
            </footer>
          </>
        )}
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .dashboard {
          min-height: 100vh;
          background: #0b0d10;
          color: #f5f5f5;
          padding: 24px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .container {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        h1,
        h2,
        p {
          margin-top: 0;
        }

        .header p {
          color: #9ca3af;
        }

        .refresh {
          border: 0;
          border-radius: 8px;
          padding: 11px 18px;
          background: #f5f5f5;
          color: #111827;
          cursor: pointer;
          font-weight: 700;
        }

        .refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error {
          padding: 16px;
          margin-bottom: 20px;
          border-radius: 10px;
          background: #3b1111;
          border: 1px solid #7f1d1d;
          color: #fecaca;
        }

        .loading {
          padding: 40px;
          text-align: center;
          color: #9ca3af;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 24px;
          border: 1px solid #272b33;
          border-radius: 14px;
          background: #111419;
          margin-bottom: 20px;
        }

        .label,
        .trade-grid span,
        .analysis-grid span,
        .confidence span,
        .stats span {
          display: block;
          color: #9ca3af;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .hero-price {
          font-size: 42px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .signal,
        .trend {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 12px;
          font-weight: 800;
          font-size: 12px;
        }

        .long,
        .bullish {
          background: #12351f;
          color: #86efac;
        }

        .short,
        .bearish {
          background: #3b1111;
          color: #fca5a5;
        }

        .wait,
        .neutral {
          background: #302b12;
          color: #fde68a;
        }

        .confidence {
          text-align: right;
        }

        .confidence strong {
          font-size: 32px;
        }

        .timeframes {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .timeframe-card,
        .trade-plan,
        .analysis,
        .live-sources > div {
          border: 1px solid #272b33;
          border-radius: 14px;
          background: #111419;
          padding: 20px;
        }

        .timeframe-title {
          font-weight: 800;
          margin-bottom: 12px;
        }

        .price {
          font-size: 26px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .stats {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 16px;
        }

        .stats strong,
        .trade-grid strong,
        .analysis-grid strong {
          font-size: 15px;
        }

        .trade-plan,
        .analysis {
          margin-bottom: 20px;
        }

        .trade-grid,
        .analysis-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .live-sources {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        pre {
          max-height: 350px;
          overflow: auto;
          padding: 14px;
          border-radius: 8px;
          background: #08090b;
          color: #d1d5db;
          font-size: 11px;
        }

        footer {
          padding: 20px 0;
          color: #6b7280;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .timeframes,
          .live-sources {
            grid-template-columns: 1fr;
          }

          .trade-grid,
          .analysis-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .dashboard {
            padding: 14px;
          }

          .header,
          .hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .confidence {
            text-align: left;
          }

          .trade-grid,
          .analysis-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
