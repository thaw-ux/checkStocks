import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { fetchAllCategorizedNews, fetchDailyBrokerResearchFeeds } from "@/lib/data/news";
import { getStockMeta } from "@/lib/set50";
import type { NewsPickItem } from "@/lib/types";

export async function GET(request: Request) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const data = await getOrFetch(
      "api:scanner:news-picks",
      12 * 60 * 1000,
      async () => {
        const [catNews, brokerReports] = await Promise.all([
          fetchAllCategorizedNews(forceRefresh),
          fetchDailyBrokerResearchFeeds(undefined, forceRefresh),
        ]);

        const map = new Map<
          string,
          {
            sources: Set<string>;
            headlines: { title: string; link: string; source: string; pubDate: string }[];
            pos: number;
            neg: number;
          }
        >();

        const pushMention = (
          symbol: string,
          source: string,
          title: string,
          link: string,
          pubDate: string,
          sentimentHint?: "positive" | "neutral" | "negative"
        ) => {
          const cur = map.get(symbol) ?? {
            sources: new Set<string>(),
            headlines: [],
            pos: 0,
            neg: 0,
          };
          cur.sources.add(source);
          if (!cur.headlines.some((h) => h.title === title)) {
            cur.headlines.push({ title, link, source, pubDate });
          }
          if (sentimentHint === "positive" || /ซื้อ|เชียร์|เด่น|พุ่ง|นิวไฮ|Outperform|โต/i.test(title)) {
            cur.pos++;
          } else if (sentimentHint === "negative" || /ขาย|ร่วง|หั่น|ลดเป้า|ขาดทุน|เสี่ยง/i.test(title)) {
            cur.neg++;
          }
          map.set(symbol, cur);
        };

        for (const r of brokerReports) {
          pushMention(
            r.symbol,
            r.broker,
            r.headline,
            r.url,
            r.reportDate,
            r.ratingNormalized === "Buy"
              ? "positive"
              : r.ratingNormalized === "Sell"
                ? "negative"
                : "neutral"
          );
        }

        const rawHeadlines: { title: string; link: string; source: string; pubDate: string; tickers: string[] }[] = [];
        for (const list of Object.values(catNews)) {
          for (const item of list) {
            if (item.tickers && item.tickers.length > 0) {
              rawHeadlines.push({
                title: item.title,
                link: item.link,
                source: item.source,
                pubDate: item.pubDate.slice(0, 10),
                tickers: item.tickers,
              });
              for (const sym of item.tickers) {
                pushMention(sym, item.source, item.title, item.link, item.pubDate.slice(0, 10));
              }
            }
          }
        }

        const picks: NewsPickItem[] = Array.from(map.entries())
          .map(([symbol, info]) => {
            const meta = getStockMeta(symbol);
            const sentiment: NewsPickItem["sentiment"] =
              info.pos > info.neg ? "positive" : info.neg > info.pos ? "negative" : "neutral";
            return {
              rank: 0,
              symbol,
              companyName: meta.nameTh,
              sector: meta.sector,
              mentionCount: info.headlines.length,
              sources: Array.from(info.sources).slice(0, 6),
              headlines: info.headlines.slice(0, 5),
              sentiment,
            };
          })
          .sort((a, b) => b.mentionCount - a.mentionCount || b.sources.length - a.sources.length)
          .slice(0, 30)
          .map((item, idx) => ({ ...item, rank: idx + 1 }));

        return {
          picks,
          rawHeadlines: rawHeadlines.slice(0, 40),
          updatedAt: new Date().toISOString(),
        };
      },
      forceRefresh
    );

    return NextResponse.json({
      ...data,
      elapsedMs: Number((performance.now() - start).toFixed(0)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สแกนข่าวบทวิเคราะห์ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
