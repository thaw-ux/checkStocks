import type { OhlcvBar, TechnicalSetupItem } from "../types";
import { getStockMeta } from "../set50";
import { calcATR, calcEMA, calcRSI, calcSMA, roundSetTick } from "./indicators";

export function detectTechnicalSetup(
  symbol: string,
  bars: OhlcvBar[]
): TechnicalSetupItem | null {
  if (bars.length < 30) return null;

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const n = bars.length;
  const last = bars[n - 1];
  const prev = bars[n - 2];

  const ema20 = calcEMA(closes, 20)[n - 1];
  const ema50 = calcEMA(closes, 50)[n - 1];
  const ema200 = calcEMA(closes, 200)[n - 1];
  const rsi14 = calcRSI(closes, 14)[n - 1];
  const atr14 = calcATR(bars, 14)[n - 1] ?? last.close * 0.02;
  const volMa20 = calcSMA(volumes, 20)[n - 1];

  if (ema20 === null || rsi14 === null) return null;

  const price = last.close;
  const changePct1d = prev.close > 0 ? ((price - prev.close) / prev.close) * 100 : 0;
  const volRatio = volMa20 && volMa20 > 0 ? last.volume / volMa20 : 1;
  const ema200DistPct =
    ema200 && ema200 > 0 ? Number((((price - ema200) / ema200) * 100).toFixed(1)) : null;

  const prev20Bars = bars.slice(Math.max(0, n - 21), n - 1);
  const prev20High = Math.max(...prev20Bars.map((b) => b.high));
  const prev20Low = Math.min(...prev20Bars.map((b) => b.low));

  const meta = getStockMeta(symbol);

  // 1. Breakout + Volume เข้า
  if (
    price >= prev20High * 0.992 &&
    volRatio >= 1.25 &&
    changePct1d > 0.3 &&
    rsi14 >= 52 &&
    rsi14 <= 78
  ) {
    const entry = roundSetTick(price);
    const stop = roundSetTick(Math.max(price * 0.92, Math.min(ema20 * 0.99, price - atr14 * 1.5)));
    const risk = Math.max(0.02, entry - stop);
    const target = roundSetTick(entry + risk * 2.2);
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      symbol,
      companyName: meta.nameTh,
      sector: meta.sector,
      price: entry,
      changePct1d: Number(changePct1d.toFixed(2)),
      setupType: "Breakout + Volume",
      entry,
      stop,
      target,
      rrRatio,
      rsi14: Number(rsi14.toFixed(1)),
      volRatio: Number(volRatio.toFixed(2)),
      ema200DistPct,
      reasonTh: `เบรกแนวต้าน 20 วัน (${prev20High.toFixed(2)}) พร้อมวอลุ่มเข้า ${volRatio.toFixed(2)}x ของค่าเฉลี่ย`,
    };
  }

  // 2. Pullback บนขาขึ้น (> EMA200)
  if (
    ema200 !== null &&
    price > ema200 &&
    (ema50 === null || ema50 >= ema200 * 0.985) &&
    price >= ema20 * 0.965 &&
    price <= ema20 * 1.035 &&
    rsi14 >= 38 &&
    rsi14 <= 60
  ) {
    const entry = roundSetTick(price);
    const supportAnchor = Math.min(ema20, ema50 ?? ema20, prev20Low);
    const stop = roundSetTick(Math.max(price * 0.93, Math.min(supportAnchor * 0.985, price - atr14 * 1.4)));
    const risk = Math.max(0.02, entry - stop);
    const target = roundSetTick(Math.max(prev20High, entry + risk * 2.0));
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      symbol,
      companyName: meta.nameTh,
      sector: meta.sector,
      price: entry,
      changePct1d: Number(changePct1d.toFixed(2)),
      setupType: "Pullback > EMA200",
      entry,
      stop,
      target,
      rrRatio,
      rsi14: Number(rsi14.toFixed(1)),
      volRatio: Number(volRatio.toFixed(2)),
      ema200DistPct,
      reasonTh: `ย่อพักตัวใกล้แนวรับ EMA20 (${ema20.toFixed(2)}) บนโครงสร้างขาขึ้นเหนือ EMA200 (RSI ${rsi14.toFixed(0)})`,
    };
  }

  // 3. Oversold ลุ้นรีบาวด์สั้น
  if (rsi14 <= 36) {
    const entry = roundSetTick(price);
    const stop = roundSetTick(Math.max(price * 0.93, Math.min(prev20Low * 0.985, price - atr14 * 1.3)));
    const risk = Math.max(0.02, entry - stop);
    const target = roundSetTick(Math.max(ema20, entry + risk * 1.8));
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      symbol,
      companyName: meta.nameTh,
      sector: meta.sector,
      price: entry,
      changePct1d: Number(changePct1d.toFixed(2)),
      setupType: "Oversold Rebound",
      entry,
      stop,
      target,
      rrRatio,
      rsi14: Number(rsi14.toFixed(1)),
      volRatio: Number(volRatio.toFixed(2)),
      ema200DistPct,
      reasonTh: `RSI(14) ลงเขตขายมากเกินไป (${rsi14.toFixed(1)}) ลุ้นรีบาวด์กลับทดสอบ EMA20 (${ema20.toFixed(2)})`,
    };
  }

  return null;
}
