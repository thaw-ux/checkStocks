import { NextResponse } from "next/server";
import { analyzeUploadedBrokerPdfAI } from "@/lib/ai/gemini";
import { extractTextFromPdfBuffer } from "@/lib/data/pdf";
import { fetchYahooChart } from "@/lib/data/yahoo";
import { resolveStockSymbol } from "@/lib/markets";
import type { MarketId } from "@/lib/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawParam } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const modelOverride = (formData.get("model") as string | null) || undefined;
    const marketRaw = formData.get("market") as string | null;
    const marketHint: MarketId | undefined =
      marketRaw === "SP500" ||
      marketRaw === "NASDAQ100" ||
      marketRaw === "HK" ||
      marketRaw === "CHINA" ||
      marketRaw === "DR"
        ? marketRaw
        : undefined;

    const resolved = resolveStockSymbol(decodeURIComponent(rawParam), marketHint);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์ PDF บทวิเคราะห์ก่อนอัปโหลด" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .pdf เท่านั้น" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const extractedText = await extractTextFromPdfBuffer(arrayBuffer, 5000);

    if (!extractedText || extractedText.length < 30) {
      return NextResponse.json(
        { error: "ไม่พบข้อความในไฟล์ PDF นี้ (อาจเป็นไฟล์ภาพสแกนที่ไม่มีชั้นข้อความ)" },
        { status: 422 }
      );
    }

    const chart = await fetchYahooChart(resolved.yahooSymbol, "5d", "1d", false, true);
    const currentPrice = chart.meta?.regularMarketPrice || chart.bars.at(-1)?.close || 0;

    const analysis = await analyzeUploadedBrokerPdfAI({
      symbol: resolved.symbol,
      currency: resolved.currency,
      fileName: file.name,
      extractedText,
      currentPrice,
      modelOverride,
    });

    return NextResponse.json({
      fileName: file.name,
      charCount: extractedText.length,
      excerpt: extractedText.slice(0, 1200),
      ...analysis,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านไฟล์ PDF ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
