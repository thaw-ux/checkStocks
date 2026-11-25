"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FlaskConical,
  X,
  XCircle,
} from "lucide-react";
import { formatPrice } from "@/lib/markets";
import type { DataAuditItem, TradePlanCardData } from "@/lib/types";

export function SentimentBadge({
  bias,
  label,
}: {
  bias: "positive" | "neutral" | "negative";
  label?: string;
}) {
  const styles =
    bias === "positive"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : bias === "negative"
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  const dot =
    bias === "positive" ? "bg-emerald-400" : bias === "negative" ? "bg-rose-400" : "bg-amber-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label ?? (bias === "positive" ? "เชิงบวก" : bias === "negative" ? "ระวัง" : "เป็นกลาง")}
    </span>
  );
}

export function DataAuditStrip({ items }: { items: DataAuditItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-sky-400" />
        สถานะความสดและความครบถ้วนของแหล่งข้อมูล (DATA AUDIT)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {items.map((item) => {
          const Icon =
            item.status === "live"
              ? CheckCircle2
              : item.status === "partial"
                ? AlertTriangle
                : XCircle;
          const color =
            item.status === "live"
              ? "text-emerald-500 dark:text-emerald-400"
              : item.status === "partial"
                ? "text-amber-500 dark:text-amber-400"
                : "text-rose-500 dark:text-rose-400";
          return (
            <div
              key={item.id}
              className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 px-3 py-2 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {item.detail}
                </p>
              </div>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:text-sky-400 shrink-0 mt-0.5"
                  title="เปิดต้นฉบับ"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TradePlanCard({
  plan,
  onSendToTimeMachine,
  onSavePaperTrade,
}: {
  plan: TradePlanCardData;
  onSendToTimeMachine: () => void;
  onSavePaperTrade: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-sky-500/35 bg-gradient-to-br from-sky-500/10 via-slate-900/90 to-emerald-500/10 p-4 text-slate-100 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-tight">{plan.symbol}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
            {plan.action}
          </span>
        </div>
        <span className="text-xs font-bold text-emerald-300 tabular-nums">
          R:R 1 : {Number(plan.rrRatio || 0).toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2 text-center">
          <div className="text-[10px] text-slate-400 uppercase">Entry</div>
          <div className="text-sm font-bold text-sky-300 tabular-nums">
            {formatPrice(Number(plan.entry), plan.currency)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-950/70 border border-rose-500/25 p-2 text-center">
          <div className="text-[10px] text-rose-300 uppercase">Stop Loss</div>
          <div className="text-sm font-bold text-rose-400 tabular-nums">
            {formatPrice(Number(plan.stop), plan.currency)}
          </div>
        </div>
        <div className="rounded-lg bg-slate-950/70 border border-emerald-500/25 p-2 text-center">
          <div className="text-[10px] text-emerald-300 uppercase">Target</div>
          <div className="text-sm font-bold text-emerald-400 tabular-nums">
            {formatPrice(Number(plan.target), plan.currency)}
          </div>
        </div>
      </div>

      {(plan.iaaTarget || plan.timeMachineWinPct || plan.note) && (
        <div className="text-xs text-slate-300 space-y-1 mb-3">
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
            {plan.iaaTarget ? (
              <span>
                เป้า Consensus เฉลี่ย:{" "}
                <strong className="text-amber-300">
                  {formatPrice(Number(plan.iaaTarget), plan.currency)}
                </strong>
              </span>
            ) : null}
            {plan.timeMachineWinPct ? (
              <span>
                Time Machine Win:{" "}
                <strong className="text-emerald-300">{plan.timeMachineWinPct}%</strong>
              </span>
            ) : null}
          </div>
          {plan.note && <p className="text-slate-300 leading-relaxed">{plan.note}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSendToTimeMachine}
          className="flex-1 min-w-[150px] text-xs font-semibold px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          ทดสอบใน Time Machine
        </button>
        <button
          type="button"
          onClick={onSavePaperTrade}
          className="flex-1 min-w-[150px] text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/35 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          บันทึกเข้า Paper Trade
        </button>
      </div>
    </div>
  );
}

export function CollapsibleDisclaimer() {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <footer className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            คำเตือนความเสี่ยง: GLOBAL 360° AI รวบรวมข้อมูลตลาดต่างประเทศสาธารณะและจำลองสถิติเพื่อการศึกษาเท่านั้น มิใช่คำแนะนำการลงทุน โปรดตรวจสอบต้นฉบับและความเสี่ยงอัตราแลกเปลี่ยนก่อนตัดสินใจ
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 font-semibold cursor-pointer"
          >
            {expanded ? "พับเก็บ" : "อ่านเต็ม"}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 cursor-pointer"
            title="ซ่อนแถบคำเตือน"
          >
            <X className="h-3.5 w-3.5" />
            ซ่อน
          </button>
        </div>
      </div>
      {expanded && (
        <ul className="mt-2.5 pt-2.5 border-t border-amber-500/20 space-y-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/90 list-disc pl-5">
          <li>
            <strong>ไม่ใช่คำแนะนำการลงทุน:</strong> ข้อมูลราคา กราฟ เป้า Consensus และบทสรุป AI เป็นเพียงเครื่องมือช่วยคัดกรองและศึกษาข้อมูลสาธารณะ ผู้ลงทุนต้องตัดสินใจด้วยตนเอง
          </li>
          <li>
            <strong>ข้อจำกัดของข้อมูล & AI:</strong> ราคาจาก Yahoo Finance อาจดีเลย์ประมาณ 15 นาที และโมเดล AI อาจมีความคลาดเคลื่อน (AI Hallucination) โปรดคลิกลิงก์ต้นฉบับตรวจสอบเสมอ
          </li>
          <li>
            <strong>ผลจำลองในอดีตไม่การันตีอนาคต:</strong> ผลลัพธ์จาก Time Machine 10,000 รอบ และ Backtest 12 สัปดาห์ เป็นการจำลองเชิงสถิติ ไม่รับประกันผลตอบแทนในอนาคต
          </li>
        </ul>
      )}
    </footer>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 animate-pulse space-y-2.5">
      <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-3 rounded bg-slate-200/80 dark:bg-slate-800/80"
          style={{ width: `${92 - idx * 12}%` }}
        />
      ))}
    </div>
  );
}
