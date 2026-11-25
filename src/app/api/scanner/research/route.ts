import { NextResponse } from "next/server";
import { fetchMarketConsensusByMarket } from "@/lib/data/marketConsensus";
import { fetchDailyBrokerResearchFeeds } from "@/lib/data/news";
import { parseMarketId } from "@/lib/markets";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const market = parseMarketId(searchParams.get("market"), "NASDAQ100");

    const consensusData = await fetchMarketConsensusByMarket(market, false);
    const priceLookup = new Map<string, number>();
    for (const r of consensusData.records) {
      priceLookup.set(r.symbol, r.price);
    }

    const reports = await fetchDailyBrokerResearchFeeds(priceLookup, forceRefresh, market);
    const brokers = Array.from(new Set(reports.map((r) => r.broker))).sort();

    return NextResponse.json({
      market,
      count: reports.length,
      brokerCount: brokers.length,
      brokers,
      reports,
      elapsedMs: Number((performance.now() - start).toFixed(0)),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "โหลดบทวิเคราะห์โบรกเกอร์ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
