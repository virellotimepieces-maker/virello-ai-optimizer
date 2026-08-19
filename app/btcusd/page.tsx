"use client";

import { useEffect, useState } from "react";

type Timeframe = {
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  support: number;
  resistance: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  elliottWave: {
    wave: string;
    bias: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidence: number;
  };
};

type BTCData = {
  success: boolean;
  symbol: string;
  generatedAt: string;
  signal: "LONG" | "SHORT" | "WAIT";
  confidence: number;
  timeframes: Record<string, Timeframe>;
  tradePlan: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
  };
  elliottWave: {
    wave: string;
    bias: "BULLISH" | "BEARISH" | "NEUTRAL";
    confidence: number;
  };
  liquidationHeatmap: {
    status: string;
    message: string;
  };
  riskManagement: {
    riskPerTrade: string;
    stopLossRequired: boolean;
    leverage: string;
  };
  analysis: {
    trend: string;
    rsi: number;
    support: number;
    resistance: number;
    ema20: number;
    ema50: number;
    ema200: number;
  };
  error?: string;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function trendClass(trend: string) {
  if (trend === "BULLISH") return "bullish";
  if (trend === "BEARISH") return "bearish";
  return "neutral";
}

export default function BTCUSDPage() {
  const [data, setData] = useState<BTCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBTCUSD() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/btcusd", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "BTCUSD analysis failed.",
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load BTCUSD data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBTCUSD();

    const interval = setInterval(() => {
      loadBTCUSD();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <main className="btc-page">
        <div className="btc-loading">
          <div className="spinner" />
          <h2>Loading live BTCUSD analysis...</h2>
          <p>Connecting to the BTCUSD analysis API.</p>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="btc-page">
        <div className="btc-error">
          <h1>BTCUSD</h1>
          <p>{error}</p>
          <button onClick={loadBTCUSD}>
            Try Again
          </button>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!data) return null;

  const primary = data.timeframes["1h"];
  const fifteen = data.timeframes["15m"];
  const fourHour = data.timeframes["4h"];

  return (
    <main className="btc-page">
      <div className="container">

        {/* HEADER */}
        <header className="header">
          <div>
            <div className="live-label">
              <span className="live-dot" />
              LIVE MARKET ANALYSIS
            </div>

            <h1>BTCUSD</h1>

            <p className="subtitle">
              Bitcoin / US Dollar
            </p>
          </div>

          <button
            className="refresh"
            onClick={loadBTCUSD}
            disabled={loading}
          >
            {loading ? "Updating..." : "Refresh"}
          </button>
        </header>

        {/* PRICE + SIGNAL */}
        <section className="hero-grid">

          <div className="card price-card">
            <span className="label">
              CURRENT PRICE
            </span>

            <div className="price">
              ${formatPrice(primary.price)}
            </div>

            <div className="updated">
              Updated{" "}
              {new Date(
                data.generatedAt,
              ).toLocaleTimeString()}
            </div>
          </div>

          <div className="card signal-card">
            <span className="label">
              PRIMARY SIGNAL
            </span>

            <div
              className={`signal ${data.signal.toLowerCase()}`}
            >
              {data.signal}
            </div>

            <div className="confidence">
              Confidence:{" "}
              <strong>{data.confidence}%</strong>
            </div>
          </div>

        </section>

        {/* TIMEFRAMES */}
        <section>
          <h2>Multi-Timeframe Analysis</h2>

          <div className="timeframe-grid">
            {[
              ["15m", fifteen],
              ["1h", primary],
              ["4h", fourHour],
            ].map(([name, tf]) => {
              const timeframe = tf as Timeframe;

              return (
                <div className="card" key={name as string}>
                  <div className="tf-header">
                    <h3>{name}</h3>

                    <span
                      className={`trend ${trendClass(
                        timeframe.trend,
                      )}`}
                    >
                      {timeframe.trend}
                    </span>
                  </div>

                  <div className="tf-price">
                    $
                    {formatPrice(
                      timeframe.price,
                    )}
                  </div>

                  <div className="metrics">
                    <div>
                      <span>RSI 14</span>
                      <strong>
                        {timeframe.rsi14}
                      </strong>
                    </div>

                    <div>
                      <span>ATR 14</span>
                      <strong>
                        {formatPrice(
                          timeframe.atr14,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>EMA 20</span>
                      <strong>
                        {formatPrice(
                          timeframe.ema20,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>EMA 50</span>
                      <strong>
                        {formatPrice(
                          timeframe.ema50,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>EMA 200</span>
                      <strong>
                        {formatPrice(
                          timeframe.ema200,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Support</span>
                      <strong>
                        ${formatPrice(
                          timeframe.support,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Resistance</span>
                      <strong>
                        ${formatPrice(
                          timeframe.resistance,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ELLIOTT WAVE */}
        <section>
          <h2>Elliott Wave Analysis</h2>

          <div className="card wave-card">
            <div>
              <span className="label">
                CURRENT STRUCTURE
              </span>

              <h3>
                {data.elliottWave.wave}
              </h3>

              <p>
                Bias:{" "}
                <strong>
                  {data.elliottWave.bias}
                </strong>
              </p>
            </div>

            <div className="wave-confidence">
              <span>Confidence</span>
              <strong>
                {data.elliottWave.confidence}%
              </strong>
            </div>
          </div>
        </section>

        {/* TRADE PLAN */}
        <section>
          <h2>Trade Plan</h2>

          <div className="trade-grid">

            <div className="card trade-item">
              <span>ENTRY</span>
              <strong>
                ${formatPrice(
                  data.tradePlan.entry,
                )}
              </strong>
            </div>

            <div className="card trade-item">
              <span>STOP LOSS</span>
              <strong>
                ${formatPrice(
                  data.tradePlan.stopLoss,
                )}
              </strong>
            </div>

            <div className="card trade-item">
              <span>TAKE PROFIT 1</span>
              <strong>
                ${formatPrice(
                  data.tradePlan.takeProfit1,
                )}
              </strong>
            </div>

            <div className="card trade-item">
              <span>TAKE PROFIT 2</span>
              <strong>
                ${formatPrice(
                  data.tradePlan.takeProfit2,
                )}
              </strong>
            </div>

          </div>
        </section>

        {/* SUPPORT / RESISTANCE */}
        <section>
          <h2>Key Levels</h2>

          <div className="levels-grid">

            <div className="card level-card">
              <span>SUPPORT</span>
              <strong>
                ${formatPrice(
                  primary.support,
                )}
              </strong>
            </div>

            <div className="card level-card">
              <span>RESISTANCE</span>
              <strong>
                ${formatPrice(
                  primary.resistance,
                )}
              </strong>
            </div>

          </div>
        </section>

        {/* LIQUIDATION HEATMAP */}
        <section>
          <h2>Liquidation Heatmap</h2>

          <div className="card heatmap-card">
            <div className="heatmap-status">
              <span className="status-dot" />

              <strong>
                {data.liquidationHeatmap.status}
              </strong>
            </div>

            <p>
              {data.liquidationHeatmap.message}
            </p>

            <small>
              No liquidation levels are
              invented or estimated as live
              data.
            </small>
          </div>
        </section>

        {/* RISK */}
        <section>
          <h2>Risk Management</h2>

          <div className="card risk-card">
            <div>
              <span>Risk per trade</span>
              <strong>
                {data.riskManagement.riskPerTrade}
              </strong>
            </div>

            <div>
              <span>Stop loss</span>
              <strong>
                {data.riskManagement
                  .stopLossRequired
                  ? "Required"
                  : "Optional"}
              </strong>
            </div>

            <div>
              <span>Leverage</span>
              <strong>
                {data.riskManagement.leverage}
              </strong>
            </div>
          </div>
        </section>

        <footer>
          BTCUSD analysis • Live API data •
          Educational use only
        </footer>

      </div>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .btc-page {
    min-height: 100vh;
    background: #07090d;
    color: #f5f7fa;
    padding: 30px 16px 60px;
    font-family: Arial, sans-serif;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 30px;
  }

  h1 {
    margin: 8px 0 4px;
    font-size: 42px;
    letter-spacing: -1px;
  }

  h2 {
    margin: 34px 0 14px;
    font-size: 21px;
  }

  h3 {
    margin: 8px 0;
  }

  .subtitle {
    color: #8d96a5;
    margin: 0;
  }

  .live-label {
    color: #55d68a;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .live-dot,
  .status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #55d68a;
    margin-right: 7px;
  }

  .refresh,
  .btc-error button {
    border: 1px solid #303744;
    background: #11151d;
    color: white;
    padding: 11px 17px;
    border-radius: 9px;
    cursor: pointer;
    font-weight: 600;
  }

  .refresh:disabled {
    opacity: .5;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 16px;
  }

  .card {
    background: #0e1219;
    border: 1px solid #252c37;
    border-radius: 14px;
    padding: 20px;
  }

  .label,
  .trade-item span,
  .level-card span,
  .metrics span,
  .risk-card span {
    color: #7f8998;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .7px;
  }

  .price {
    font-size: 40px;
    font-weight: 800;
    margin-top: 12px;
  }

  .updated {
    color: #747e8d;
    font-size: 12px;
    margin-top: 8px;
  }

  .signal {
    font-size: 42px;
    font-weight: 900;
    margin-top: 10px;
  }

  .signal.long,
  .bullish {
    color: #55d68a;
  }

  .signal.short,
  .bearish {
    color: #ff6875;
  }

  .signal.wait,
  .neutral {
    color: #f1c75b;
  }

  .confidence {
    color: #929ba9;
    margin-top: 8px;
  }

  .timeframe-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .tf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tf-header h3 {
    font-size: 22px;
  }

  .trend {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .5px;
  }

  .tf-price {
    font-size: 24px;
    font-weight: 800;
    margin: 15px 0;
  }

  .metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .metrics div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .metrics strong {
    font-size: 13px;
  }

  .wave-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  .wave-card p {
    color: #9ba4b2;
  }

  .wave-confidence {
    text-align: center;
  }

  .wave-confidence span {
    display: block;
    color: #7f8998;
    font-size: 11px;
  }

  .wave-confidence strong {
    display: block;
    font-size: 30px;
    margin-top: 6px;
  }

  .trade-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  .trade-item strong {
    display: block;
    font-size: 19px;
    margin-top: 10px;
  }

  .levels-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .level-card strong {
    display: block;
    font-size: 25px;
    margin-top: 8px;
  }

  .heatmap-status {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }

  .heatmap-status .status-dot {
    background: #f1c75b;
  }

  .heatmap-card p {
    color: #a6afbd;
    line-height: 1.6;
  }

  .heatmap-card small {
    color: #6f7887;
  }

  .risk-card {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .risk-card div {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  footer {
    color: #606a78;
    text-align: center;
    margin-top: 45px;
    font-size: 12px;
  }

  .btc-loading,
  .btc-error {
    max-width: 600px;
    margin: 120px auto;
    text-align: center;
  }

  .btc-error p {
    color: #ff6875;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #29313d;
    border-top-color: #55d68a;
    border-radius: 50%;
    margin: 0 auto 20px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 800px) {
    .hero-grid,
    .timeframe-grid {
      grid-template-columns: 1fr;
    }

    .trade-grid {
      grid-template-columns: 1fr 1fr;
    }

    .risk-card {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 500px) {
    .btc-page {
      padding: 20px 12px 45px;
    }

    .header {
      align-items: flex-start;
    }

    h1 {
      font-size: 34px;
    }

    .price,
    .signal {
      font-size: 32px;
    }

    .trade-grid,
    .levels-grid {
      grid-template-columns: 1fr;
    }
  }
`;
