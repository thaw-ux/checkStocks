import { NextResponse } from "next/server";
import { generateDailyBriefingAI } from "@/lib/ai/gemini";
import { getOrFetch } from "@/lib/cache";
import { fetchPeerMetricsBatch } from "@/lib/data/marketConsensus";
import { fetchAllCategorizedNews } from "@/lib/data/news";
import { fetchFxRatesToThb, fetchGlobalMacro12, fetchIndexSrRadar5 } from "@/lib/data/yahoo";
import { resolveStockSymbol } from "@/lib/markets";
import type { DataAuditItem, MarketOverviewPayload } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const modelOverride = searchParams.get("model") || undefined;

    const payload = await getOrFetch<MarketOverviewPayload>(
      `api:market:overview:global:v2:${modelOverride ?? "default"}`,
      10 * 60 * 1000,
      async () => {
        const now = new Date().toISOString();
        const [macroCards, fxRates, categorizedNews, indexSrRadar] = await Promise.all([
          fetchGlobalMacro12(forceRefresh),
          fetchFxRatesToThb(forceRefresh),
          fetchAllCategorizedNews(forceRefresh),
          fetchIndexSrRadar5(forceRefresh),
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

        // Enrich affected international stocks with live prices & native currency
        const affectedSymbols = aiResult.affectedStocks.map((s) => s.symbol);
        const liveMetrics = await fetchPeerMetricsBatch(affectedSymbols, forceRefresh);
        const metricMap = new Map(liveMetrics.map((m) => [m.symbol, m]));

        const affectedStocks = aiResult.affectedStocks.map((s) => {
          const meta = resolveStockSymbol(s.symbol, s.market);
          const live = metricMap.get(meta.symbol);
          return {
            ...s,
            symbol: meta.symbol,
            market: s.market ?? meta.market,
            currency: live?.currency ?? s.currency ?? meta.currency,
            price: live?.price ?? undefined,
            changePct: live?.changePct ?? undefined,
          };
        });

        const dataAudit: DataAuditItem[] = [
          {
            id: "macro",
            label: "ดัชนีตลาดโลก & อัตราแลกเปลี่ยน (Yahoo Finance)",
            status:
              macroCards.length >= 10 ? "live" : macroCards.length > 0 ? "partial" : "unavailable",
            detail: `ดึงข้อมูลสำเร็จ ${macroCards.length}/12 ตัวชี้วัด (USD/THB ${fxRates.USD.toFixed(2)} · HKD/THB ${fxRates.HKD.toFixed(2)})`,
            url: "https://finance.yahoo.com/quote/%5EGSPC",
            timestamp: now,
          },
          {
            id: "news",
            label: "ข่าวการเงินต่างประเทศ & Wall Street Calls 7 หมวด (RSS สด)",
            status: totalHeadlines >= 15 ? "live" : totalHeadlines > 0 ? "partial" : "unavailable",
            detail: `รวบรวมพาดหัวข่าวสหรัฐฯ ฮ่องกง จีน และมหภาคโลก ${totalHeadlines} รายการล่าสุด`,
            timestamp: now,
          },
          {
            id: "ai_brief",
            label: `Global Morning Briefing (${aiResult.modelUsed})`,
            status: aiResult.isAiGenerated ? "live" : "partial",
            detail: aiResult.isAiGenerated
              ? "สังเคราะห์ข่าวโลกครบ 6 มิติเป็นภาษาไทยด้วย Google Gemini API"
              : "โหมดสรุป Rule-Based (ใส่ GEMINI_API_KEY เพื่อเปิด AI เต็มรูปแบบ)",
            timestamp: now,
          },
        ];

        return {
          macroCards,
          fxRates,
          indexSrRadar,
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
      { error: err instanceof Error ? err.message : "ไม่สามารถโหลดภาพรวมตลาดโลกได้" },
      { status: 500 }
    );
  }
}
