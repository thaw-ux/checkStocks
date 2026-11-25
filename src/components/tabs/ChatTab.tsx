"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { TradePlanCard } from "@/components/common/UiPrimitives";
import type { ChatMessage, TradePlanCardData } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const QUICK_PROMPTS = [
  "เช็กแนวรับ-แนวต้านดัชนี S&P 500 (^GSPC) และ Nasdaq 100 (^NDX) ทั้ง Day และ Week",
  "วิเคราะห์หุ้น NVDA (Nasdaq 100) พร้อมแนวรับ S1/S2 แนวต้าน R1/R2 และ Time Machine",
  "ดูแนวรับ-แนวต้านหุ้นฮ่องกง 0700.HK (Tencent) กับ 1211.HK (BYD) ตัวไหนชิดแนวรับกว่า?",
  "วิเคราะห์หุ้นจีน A-Share 600519.SS (Moutai) และ BABA (ADR) เทียบกันให้หน่อย",
  "วิเคราะห์ DR หุ้นนอก NVDA80 กับ TENCENT80 และสแกนหุ้น Nasdaq 100 ชิดแนวรับวันนี้",
  "ช่วยตรวจความเสี่ยงพอร์ต Paper Trade ของฉันหน่อย",
];

function extractTradePlan(content: string): {
  cleanMarkdown: string;
  tradePlan: TradePlanCardData | null;
} {
  const regex = /```tradeplan\s*([\s\S]*?)```/i;
  const match = content.match(regex);
  if (!match?.[1]) {
    return { cleanMarkdown: content, tradePlan: null };
  }
  try {
    const parsed = JSON.parse(match[1].trim()) as TradePlanCardData;
    if (parsed && parsed.symbol && typeof parsed.entry === "number") {
      return {
        cleanMarkdown: content.replace(regex, "").trim(),
        tradePlan: parsed,
      };
    }
  } catch {
    // Incomplete JSON while still streaming
  }
  return { cleanMarkdown: content.replace(/```tradeplan[\s\S]*$/i, "").trim(), tradePlan: null };
}

function renderFormattedLines(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    // Highlight mandatory 1st-line verdict
    if (i <= 1 && /^(?:\*\*)?ฟันธง\s*:/i.test(trimmed)) {
      const cleaned = trimmed.replace(/\*\*/g, "");
      return (
        <div
          key={i}
          className="rounded-xl bg-sky-500/15 border border-sky-500/35 px-3.5 py-2.5 text-sm font-bold text-sky-700 dark:text-sky-200 mb-2"
        >
          ⚡ {cleaned}
        </div>
      );
    }

    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={i} className="text-xs font-extrabold text-amber-500 mt-3 mb-1">
          {trimmed.slice(4)}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="text-sm font-extrabold text-sky-500 mt-3 mb-1">
          {trimmed.slice(3)}
        </h3>
      );
    }

    // Simple bold **text** rendering
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-xs sm:text-[13px] leading-relaxed">
        {parts.map((part, idx) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={idx} className="font-bold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </p>
    );
  });
}

export function ChatTab() {
  const {
    paperTrades,
    activeSymbol,
    activeMarket,
    modelSettings,
    jumpToTimeMachine,
    quickAddPlanToPaperTrade,
  } = useAppStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "**ฟันธง:** พร้อมช่วยวิเคราะห์หุ้นต่างประเทศ 5 ตลาดหลักแบบเรียลไทม์ครับ — พิมพ์ชื่อหุ้น **สหรัฐฯ S&P 500 / Nasdaq 100 (`NVDA`, `AAPL`, `TSLA`, `^GSPC`)**, **ฮ่องกง HKEX (`0700.HK`, `9988.HK`, `1211.HK`, `0005.HK`, `^HSI`)**, **จีน A-Share / ADR (`600519.SS`, `300750.SZ`, `BABA`, `PDD`)**, หรือ **DR หุ้นนอก (`NVDA80`, `TENCENT80`, `NDX01`)** ระบบจะดึงราคาสด, เป้า Consensus, กรอบแนวรับ-ต้าน Smart Confluence (Day/Week) และจำลอง Time Machine 10,000 รอบมาฟันธงให้ทันที!\n\nนอกจากนี้คุณยังถามได้อีก:\n- สแกนหุ้น Breakout / Pullback / ชิดแนวรับ S1 ของ S&P 500, Nasdaq 100, ฮ่องกง, จีน หรือ DR\n- สรุปพอร์ตจำลองรายสัปดาห์ 360° (5 มิติ) ของแต่ละตลาด\n- ให้ช่วยตรวจความเสี่ยงพอร์ต Paper Trade ส่วนตัวของคุณ",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const assistantId = `a-${Date.now() + 1}`;
    const placeholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    const historyForApi = [...messages.filter((m) => m.id !== "welcome"), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyForApi,
          paperTrades,
          activeSymbol,
          activeMarket,
          model: modelSettings.proModel,
        }),
      });

      const modelUsed = res.headers.get("X-Model-Used") || modelSettings.proModel;
      const detectedHeader = res.headers.get("X-Detected-Tickers") || "";
      const detectedTickers = detectedHeader ? detectedHeader.split(",").filter(Boolean) : [];

      if (!res.ok || !res.body) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || "ไม่สามารถเชื่อมต่อ AI Chat Bot ได้");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const { tradePlan } = extractTradePlan(accumulated);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: accumulated, tradePlan, modelUsed, detectedTickers }
              : m
          )
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดระหว่างสนทนา";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `⚠️ ${errMsg}` } : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex flex-col h-[calc(100vh-220px)] min-h-[560px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-slate-950">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              AI Chat Bot 360° (สหรัฐฯ · ฮ่องกง · จีน · DR)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30 font-semibold">
                {modelSettings.proModel}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              เชื่อมต่อข้อมูลสด 5 ตลาดต่างประเทศ (ราคา · เป้า Consensus · Smart Confluence S/R · Time Machine 10,000 รอบ · Paper Trade {paperTrades.length} รายการ)
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMessages((prev) => prev.slice(0, 1))}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-400 inline-flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" /> ล้างแชต
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-950/40 flex gap-2 overflow-x-auto">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={streaming}
            onClick={() => void sendMessage(q)}
            className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-500 transition cursor-pointer disabled:opacity-50"
          >
            ✨ {q}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const { cleanMarkdown, tradePlan } = isUser
            ? { cleanMarkdown: msg.content, tradePlan: null }
            : extractTradePlan(msg.content);

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="h-8 w-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5 text-sky-500">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                  isUser
                    ? "bg-sky-500 text-slate-950 font-medium text-sm"
                    : "bg-slate-100/90 dark:bg-slate-950/85 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                {!isUser && msg.detectedTickers && msg.detectedTickers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px] text-slate-500">
                    <span>ดึงข้อมูลสด 360°:</span>
                    {msg.detectedTickers.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {isUser ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : cleanMarkdown ? (
                  <div className="space-y-1">{renderFormattedLines(cleanMarkdown)}</div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                    กำลังดึงราคาสด เป้า Consensus และรัน Time Machine 10,000 รอบให้ Gemini Pro วิเคราะห์...
                  </div>
                )}

                {!isUser && (tradePlan || msg.tradePlan) && (
                  <TradePlanCard
                    plan={(tradePlan || msg.tradePlan)!}
                    onSendToTimeMachine={() => {
                      const p = (tradePlan || msg.tradePlan)!;
                      jumpToTimeMachine({
                        symbol: p.symbol,
                        market: p.market,
                        entry: p.entry,
                        stop: p.stop,
                        target: p.target,
                        sourceLabel: "AI Chat Bot",
                      });
                    }}
                    onSavePaperTrade={() =>
                      quickAddPlanToPaperTrade((tradePlan || msg.tradePlan)!)
                    }
                  />
                )}

                {!isUser && msg.modelUsed && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 text-[10px] text-slate-500">
                    Model: {msg.modelUsed}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-slate-600 dark:text-slate-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center gap-2"
      >
        <MessageSquare className="h-4 w-4 text-slate-400 hidden sm:block shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder="พิมพ์ชื่อหุ้นสหรัฐฯ/ฮ่องกง/จีน/DR เช่น 'วิเคราะห์ NVDA', '0700.HK เทนเซ็นต์', '600519.SS', 'NVDA80' หรือ 'สแกนฮ่องกง Breakout'..."
          className="flex-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-sky-400"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          ส่งคำถาม
        </button>
      </form>
    </div>
  );
}
