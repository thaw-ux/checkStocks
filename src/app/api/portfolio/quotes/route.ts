import { NextResponse } from "next/server";
import { fetchPeerMetricsBatch } from "@/lib/data/marketConsensus";
import { fetchFxRatesToThb } from "@/lib/data/yahoo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsRaw = searchParams.get("symbols") || "";
    const symbols = symbolsRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 25);

    const [rows, fxRates] = await Promise.all([
      symbols.length > 0 ? fetchPeerMetricsBatch(symbols) : Promise.resolve([]),
      fetchFxRatesToThb(),
    ]);

    const quotes: Record<string, { price: number | null; changePct: number | null; currency?: string }> = {};
    for (const r of rows) {
      quotes[r.symbol] = { price: r.price, changePct: r.changePct, currency: r.currency };
    }
    return NextResponse.json({
      quotes,
      fxRates,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      quotes: {},
      fxRates: { USD: 34.0, HKD: 4.35, CNY: 4.8, THB: 1, updatedAt: new Date().toISOString() },
    });
  }
}
