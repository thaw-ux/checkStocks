import { NextResponse } from "next/server";
import { generateDailyBriefingAI } from "@/lib/ai/gemini";
import { getOrFetch } from "@/lib/cache";
import { fetchPeerMetricsBatch } from "@/lib/data/marketConsensus";
import { fetchAllCategorizedNews } from "@/lib/data/news";
import { fetchGlobalMacro12 } from "@/lib/data/yahoo";
import type { DataAuditItem, MarketOverviewPayload } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const modelOverride = searchParams.get("model") || undefined;

    const payload = await getOrFetch<MarketOverviewPayload>(
      `api:market:overview:${modelOverride ?? "default"}`,
      10 * 60 * 1000,
      async () => {
        const now = new Date().toISOString();
        const [macroCards, categorizedNews] = await Promise.all([
          fetchGlobalMacro12(forceRefresh),
          fetchAllCategorizedNews(forceRefresh),
        ]);

        const totalHeadlines = Object.values(categorizedNews).reduce(
          (sum, list) => sum + list.length,
          0
        );

        const aiResult = await generateDailyBriefingAI({
          macroCards,
          categorizedNews,
          modelOverride,
        });

        // Enrich affected stocks with live SET prices
        const affectedSymbols = aiResult.affectedStocks.map((s) => s.symbol);
        const liveMetrics = await fetchPeerMetricsBatch(affectedSymbols, forceRefresh);
        const metricMap = new Map(liveMetrics.map((m) => [m.symbol, m]));

        const affectedStocks = aiResult.affectedStocks.map((s) => {
          const live = metricMap.get(s.symbol);
          return {
            ...s,
            price: live?.price ?? undefined,
            changePct: live?.changePct ?? undefined,
          };
        });

        const dataAudit: DataAuditItem[] = [
          {
            id: "macro",
            label: "ดัชนีตลาดโลก & ทอง/น้ำมัน/บาท (Yahoo Finance)",
            status: macroCards.length >= 10 ? "live" : macroCards.length > 0 ? "partial" : "unavailable",
            detail: `ดึงข้อมูลสำเร็จ ${macroCards.length}/12 ตัวชี้วัด (ดีเลย์ ~15 นาที)`,
            url: "https://finance.yahoo.com/quote/%5ESET.BK",
            timestamp: now,
          },
          {
            id: "news",
            label: "ข่าวหุ้นไทย & โพยโบรกเกอร์ 7 หมวด (RSS สด)",
            status: totalHeadlines >= 15 ? "live" : totalHeadlines > 0 ? "partial" : "unavailable",
            detail: `รวบรวมพาดหัวสาธารณะ ${totalHeadlines} รายการจากข่าวหุ้น/มิติหุ้น/HoonSmart/Google News`,
            timestamp: now,
          },
          {
            id: "ai_brief",
            label: `AI Daily Briefing (${aiResult.modelUsed})`,
            status: aiResult.isAiGenerated ? "live" : "partial",
            detail: aiResult.isAiGenerated
              ? "สังเคราะห์ครบ 6 มิติด้วย Google Gemini API"
              : "โหมดสรุป Rule-Based (ใส่ GEMINI_API_KEY เพื่อเปิด AI เต็มรูปแบบ)",
            timestamp: now,
          },
        ];

        return {
          macroCards,
          briefing: {
            headline: aiResult.headline,
            mood: aiResult.mood,
            sections: aiResult.sections,
            modelUsed: aiResult.modelUsed,
            isAiGenerated: aiResult.isAiGenerated,
          },
          affectedStocks,
          categorizedNews,
          totalHeadlines,
          dataAudit,
          generatedAt: now,
        };
      },
      forceRefresh
    );

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ไม่สามารถโหลดภาพรวมตลาดได้" },
      { status: 500 }
    );
  }
}
