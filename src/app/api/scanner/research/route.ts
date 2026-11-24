import { NextResponse } from "next/server";
import { fetchMarketConsensusAll } from "@/lib/data/marketConsensus";
import { fetchDailyBrokerResearchFeeds } from "@/lib/data/news";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const consensusData = await fetchMarketConsensusAll(false);
    const priceLookup = new Map<string, number>();
    for (const r of consensusData.records) {
      priceLookup.set(r.symbol, r.price);
    }

    const reports = await fetchDailyBrokerResearchFeeds(priceLookup, forceRefresh);
    const brokers = Array.from(new Set(reports.map((r) => r.broker))).sort();

    return NextResponse.json({
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
