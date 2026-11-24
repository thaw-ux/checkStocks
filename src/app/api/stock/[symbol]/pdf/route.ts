import { NextResponse } from "next/server";
import { analyzeUploadedBrokerPdfAI } from "@/lib/ai/gemini";
import { extractTextFromPdfBuffer } from "@/lib/data/pdf";
import { fetchYahooChart } from "@/lib/data/yahoo";
import { normalizeThaiSymbol, toYahooSymbol } from "@/lib/set50";

export async function POST(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawParam } = await context.params;
    const symbol = normalizeThaiSymbol(rawParam);
    const formData = await request.formData();
    const file = formData.get("file");
    const modelOverride = (formData.get("model") as string | null) || undefined;

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

    const chart = await fetchYahooChart(toYahooSymbol(symbol), "5d", "1d");
    const currentPrice = chart.meta?.regularMarketPrice || chart.bars.at(-1)?.close || 0;

    const analysis = await analyzeUploadedBrokerPdfAI({
      symbol,
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
