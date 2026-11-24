import { NextResponse } from "next/server";
import { fetchPeerMetricsBatch } from "@/lib/data/marketConsensus";
import { normalizeThaiSymbol } from "@/lib/set50";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsRaw = searchParams.get("symbols") || "";
    const symbols = symbolsRaw
      .split(",")
      .map(normalizeThaiSymbol)
      .filter(Boolean)
      .slice(0, 25);

    if (symbols.length === 0) {
      return NextResponse.json({ quotes: {} });
    }

    const rows = await fetchPeerMetricsBatch(symbols);
    const quotes: Record<string, { price: number | null; changePct: number | null }> = {};
    for (const r of rows) {
      quotes[r.symbol] = { price: r.price, changePct: r.changePct };
    }
    return NextResponse.json({ quotes, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ quotes: {} });
  }
}
