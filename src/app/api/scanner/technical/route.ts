import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { fetchYahooBatchCharts } from "@/lib/data/yahoo";
import { detectTechnicalSetup } from "@/lib/quant/scanner";
import { SET50_SYMBOLS } from "@/lib/set50";
import type { TechnicalSetupItem } from "@/lib/types";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const data = await getOrFetch(
      "api:scanner:technical:set50",
      10 * 60 * 1000,
      async () => {
        const batch = await fetchYahooBatchCharts(SET50_SYMBOLS, "1y", 12, forceRefresh);
        const setups: TechnicalSetupItem[] = [];
        let scannedCount = 0;

        for (const sym of SET50_SYMBOLS) {
          const chart = batch.get(sym);
          if (!chart?.ok || chart.bars.length < 30) continue;
          scannedCount++;
          const setup = detectTechnicalSetup(sym, chart.bars);
          if (setup) setups.push(setup);
        }

        // Sort: Breakout + Volume first, then highest R:R
        const order: Record<TechnicalSetupItem["setupType"], number> = {
          "Breakout + Volume": 0,
          "Pullback > EMA200": 1,
          "Oversold Rebound": 2,
        };
        setups.sort((a, b) => {
          if (order[a.setupType] !== order[b.setupType]) {
            return order[a.setupType] - order[b.setupType];
          }
          return b.rrRatio - a.rrRatio;
        });

        return {
          universe: "SET50",
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
      { error: err instanceof Error ? err.message : "สแกนกราฟเทคนิค SET50 ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
