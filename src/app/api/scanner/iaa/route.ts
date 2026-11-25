import { NextResponse } from "next/server";
import { fetchMarketConsensusByMarket } from "@/lib/data/marketConsensus";
import { parseMarketId } from "@/lib/markets";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const market = parseMarketId(searchParams.get("market"), "NASDAQ100");

    const { records, ok } = await fetchMarketConsensusByMarket(market, forceRefresh);
    const items = records.map((r) => ({
      ...r.consensus,
      changePct: r.changePct,
      pe: r.fundamentals.pe,
      dividendYield: r.fundamentals.dividendYield,
      marketCapBillion: r.fundamentals.marketCapBillion,
    }));

    const sectors = Array.from(new Set(items.map((i) => i.sector))).sort();

    return NextResponse.json({
      ok,
      market,
      count: items.length,
      sectors,
      items,
      elapsedMs: Number((performance.now() - start).toFixed(0)),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "โหลดตาราง Consensus ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
