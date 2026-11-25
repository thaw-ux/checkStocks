import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { fetchYahooBatchCharts } from "@/lib/data/yahoo";
import { getUniverseByMarket, MARKET_CONFIGS, parseMarketId } from "@/lib/markets";
import { detectTechnicalSetup } from "@/lib/quant/scanner";
import type { TechnicalSetupItem } from "@/lib/types";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const market = parseMarketId(searchParams.get("market"), "NASDAQ100");
    const proxRaw = Number(searchParams.get("proximity") || "3");
    const proximityPct = Number.isFinite(proxRaw) ? Math.max(1, Math.min(8, proxRaw)) : 3;

    const data = await getOrFetch(
      `api:scanner:technical:v2:${market}:p=${proximityPct}`,
      10 * 60 * 1000,
      async () => {
        const universe = getUniverseByMarket(market);
        const yahooSymbols = universe.map((u) => u.yahooSymbol);
        const batch = await fetchYahooBatchCharts(yahooSymbols, "1y", 12, forceRefresh, true);

        const setups: TechnicalSetupItem[] = [];
        let scannedCount = 0;

        for (const meta of universe) {
          const chart = batch.get(meta.yahooSymbol);
          if (!chart?.ok || chart.bars.length < 30) continue;
          scannedCount++;
          const setup = detectTechnicalSetup(meta.symbol, chart.bars, market, proximityPct);
          if (setup) setups.push(setup);
        }

        const order: Record<TechnicalSetupItem["setupType"], number> = {
          "Breakout + Volume": 0,
          "Pullback > EMA200": 1,
          "Near Support (S1)": 2,
          "Near Resistance (R1)": 3,
          "Oversold Rebound": 4,
        };
        setups.sort((a, b) => {
          if (order[a.setupType] !== order[b.setupType]) {
            return order[a.setupType] - order[b.setupType];
          }
          return b.rrRatio - a.rrRatio;
        });

        return {
          market,
          proximityPct,
          universe: MARKET_CONFIGS[market].label,
          scannedCount,
          setups,
          updatedAt: new Date().toISOString(),
        };
      },
      forceRefresh
    );

    return NextResponse.json({
      ...data,
      elapsedMs: Number((performance.now() - start).toFixed(0)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สแกนกราฟเทคนิคไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
