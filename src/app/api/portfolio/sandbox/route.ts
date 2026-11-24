import { NextResponse } from "next/server";
import { fetchYahooBatchCharts, fetchYahooChart } from "@/lib/data/yahoo";
import { runSandboxBacktest } from "@/lib/quant/portfolio360";
import { normalizeThaiSymbol } from "@/lib/set50";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      holdings?: { symbol: string; weightPct: number }[];
      lookbackDays?: number;
      initialCapital?: number;
    };

    const rawHoldings = (body.holdings ?? [])
      .map((h) => ({
        symbol: normalizeThaiSymbol(h.symbol),
        weightPct: Number(h.weightPct) || 0,
      }))
      .filter((h) => h.symbol && h.weightPct > 0)
      .slice(0, 10);

    if (rawHoldings.length === 0) {
      return NextResponse.json({ error: "กรุณาระบุหุ้นอย่างน้อย 1 ตัวพร้อมน้ำหนัก (%)" }, { status: 400 });
    }

    const lookbackDays = Math.min(240, Math.max(15, Number(body.lookbackDays) || 60));
    const initialCapital = Math.min(100_000_000, Math.max(10_000, Number(body.initialCapital) || 100_000));

    const [setChart, batch] = await Promise.all([
      fetchYahooChart("^SET.BK", "1y", "1d"),
      fetchYahooBatchCharts(
        rawHoldings.map((h) => h.symbol),
        "1y",
        8
      ),
    ]);

    const holdingsWithBars = rawHoldings
      .map((h) => ({
        ...h,
        bars: batch.get(h.symbol)?.bars ?? [],
      }))
      .filter((h) => h.bars.length > 5);

    if (holdingsWithBars.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลราคาย้อนหลังของหุ้นที่ระบุ" }, { status: 404 });
    }

    const result = runSandboxBacktest({
      holdings: holdingsWithBars,
      setBars: setChart.bars,
      lookbackDays,
      initialCapital,
    });

    return NextResponse.json({
      result,
      validSymbols: holdingsWithBars.map((h) => h.symbol),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "รัน Sandbox Backtest ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
