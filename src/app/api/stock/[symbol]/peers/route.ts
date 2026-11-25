import { NextResponse } from "next/server";
import { fetchPeerMetricsBatch } from "@/lib/data/marketConsensus";
import { getDefaultGlobalPeers, resolveStockSymbol } from "@/lib/markets";
import type { MarketId, PeerMetricRow } from "@/lib/types";

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (valid.length === 0) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawParam } = await context.params;
    const { searchParams } = new URL(request.url);
    const marketRaw = searchParams.get("market");
    const marketHint: MarketId | undefined =
      marketRaw === "SP500" ||
      marketRaw === "NASDAQ100" ||
      marketRaw === "HK" ||
      marketRaw === "CHINA" ||
      marketRaw === "DR"
        ? marketRaw
        : undefined;

    const resolved = resolveStockSymbol(decodeURIComponent(rawParam), marketHint);
    const customPeers = searchParams.get("peers");

    const peerList = customPeers
      ? customPeers
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : getDefaultGlobalPeers(resolved);

    const rows = await fetchPeerMetricsBatch(peerList, false, resolved.market);

    const sectorAverage: PeerMetricRow = {
      symbol: "📌 ค่าเฉลี่ยกลุ่ม",
      currency: resolved.currency,
      companyName: `ค่าเฉลี่ย (${rows.length} บริษัท)`,
      price: null,
      changePct: avg(rows.map((r) => r.changePct)),
      pe: avg(rows.map((r) => (r.pe && r.pe > 0 && r.pe < 250 ? r.pe : null))),
      pbv: avg(rows.map((r) => r.pbv)),
      roe: avg(rows.map((r) => r.roe)),
      dividendYield: avg(rows.map((r) => r.dividendYield)),
      marketCapBillion: avg(rows.map((r) => r.marketCapBillion)),
    };

    return NextResponse.json({
      symbol: resolved.symbol,
      market: resolved.market,
      peers: peerList,
      rows,
      sectorAverage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ดึงข้อมูลหุ้นคู่แข่งไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
