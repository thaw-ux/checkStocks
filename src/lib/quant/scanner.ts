import type { MarketId, OhlcvBar, TechnicalSetupItem } from "../types";
import { resolveStockSymbol } from "../markets";
import { calcATR, calcEMA, calcRSI, calcSMA, roundMarketTick } from "./indicators";
import { computeSmartSupportResistance } from "./supportResistance";

export function detectTechnicalSetup(
  symbol: string,
  bars: OhlcvBar[],
  market: MarketId = "NASDAQ100",
  proximityPct = 3.0
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

  const meta = resolveStockSymbol(symbol, market);
  const cur = meta.currency;
  const price = last.close;
  const changePct1d = prev.close > 0 ? ((price - prev.close) / prev.close) * 100 : 0;
  const volRatio = volMa20 && volMa20 > 0 ? last.volume / volMa20 : 1;
  const ema200DistPct =
    ema200 && ema200 > 0 ? Number((((price - ema200) / ema200) * 100).toFixed(1)) : null;

  // Smart Confluence S/R for accurate S1 / R1 / POC levels
  const sr = computeSmartSupportResistance(bars, cur, "day");
  const s1Obj = sr.supports[0];
  const r1Obj = sr.resistances[0];
  const s1 = s1Obj?.price ?? roundMarketTick(price * 0.96, cur);
  const s1DistPct = s1Obj?.distancePct ?? 4;
  const s1Strength = s1Obj?.strength ?? 2;
  const r1 = r1Obj?.price ?? roundMarketTick(price * 1.06, cur);
  const r1DistPct = r1Obj?.distancePct ?? 6;
  const r1Strength = r1Obj?.strength ?? 2;

  const prev20Bars = bars.slice(Math.max(0, n - 21), n - 1);
  const prev20High = Math.max(...prev20Bars.map((b) => b.high));
  const prev20Low = Math.min(...prev20Bars.map((b) => b.low));

  const baseFields = {
    symbol: meta.symbol,
    market: meta.market,
    currency: cur,
    companyName: meta.name,
    sector: meta.sector,
    price: roundMarketTick(price, cur),
    changePct1d: Number(changePct1d.toFixed(2)),
    rsi14: Number(rsi14.toFixed(1)),
    volRatio: Number(volRatio.toFixed(2)),
    ema200DistPct,
    s1,
    s1DistPct,
    s1Strength,
    r1,
    r1DistPct,
    r1Strength,
    pocPrice: sr.pocPrice,
    zonePositionPct: sr.zonePositionPct,
  };

  // 1. Breakout + Volume เข้า
  if (
    price >= prev20High * 0.992 &&
    volRatio >= 1.2 &&
    changePct1d > 0.25 &&
    rsi14 >= 52 &&
    rsi14 <= 80
  ) {
    const entry = roundMarketTick(price, cur);
    const stop = roundMarketTick(
      Math.max(price * 0.93, Math.min(s1 * 0.992, price - atr14 * 1.4)),
      cur
    );
    const risk = Math.max(0.02, entry - stop);
    const target = roundMarketTick(Math.max(r1, entry + risk * 2.0), cur);
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      ...baseFields,
      setupType: "Breakout + Volume",
      entry,
      stop,
      target,
      rrRatio,
      reasonTh: `เบรกแนวต้าน 20D (${prev20High.toFixed(2)}) พร้อมวอลุ่ม ${volRatio.toFixed(2)}x · แนวต้านถัดไป R1 ${r1.toFixed(2)}`,
    };
  }

  // 2. Pullback บนขาขึ้น (> EMA200)
  if (
    ema200 !== null &&
    price > ema200 &&
    (ema50 === null || ema50 >= ema200 * 0.985) &&
    price >= ema20 * 0.96 &&
    price <= ema20 * 1.035 &&
    rsi14 >= 38 &&
    rsi14 <= 60
  ) {
    const entry = roundMarketTick(price, cur);
    const stop = roundMarketTick(
      Math.max(price * 0.935, Math.min(s1 * 0.99, price - atr14 * 1.35)),
      cur
    );
    const risk = Math.max(0.02, entry - stop);
    const target = roundMarketTick(Math.max(r1, entry + risk * 1.9), cur);
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      ...baseFields,
      setupType: "Pullback > EMA200",
      entry,
      stop,
      target,
      rrRatio,
      reasonTh: `ย่อพักตัวใกล้ EMA20 (${ema20.toFixed(2)}) บนขาขึ้น >EMA200 · แนวรับ S1 ${s1.toFixed(2)} (ห่าง ${s1DistPct.toFixed(1)}%)`,
    };
  }

  // 3. ชิดแนวรับสำคัญ (Near Support S1 <= proximityPct)
  if (s1DistPct <= proximityPct && s1Strength >= 2 && rsi14 <= 62) {
    const entry = roundMarketTick(price, cur);
    const stop = roundMarketTick(Math.max(price * 0.935, Math.min(s1 * 0.982, price - atr14 * 1.2)), cur);
    const risk = Math.max(0.02, entry - stop);
    const target = roundMarketTick(Math.max(r1, entry + risk * 1.8), cur);
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      ...baseFields,
      setupType: "Near Support (S1)",
      entry,
      stop,
      target,
      rrRatio,
      reasonTh: `ราคาชิดแนวรับแข็ง S1 ${s1.toFixed(2)} (${"★".repeat(s1Strength)} · ห่างเพียง ${s1DistPct.toFixed(1)}%) ลุ้นเด้งหา R1 ${r1.toFixed(2)}`,
    };
  }

  // 4. จ่อเบรกแนวต้าน (Near Resistance R1 <= proximityPct)
  if (r1DistPct <= proximityPct && rsi14 >= 50 && rsi14 <= 78) {
    const entry = roundMarketTick(price, cur);
    const stop = roundMarketTick(Math.max(price * 0.94, Math.min(s1 * 0.99, price - atr14 * 1.3)), cur);
    const risk = Math.max(0.02, entry - stop);
    const r2 = sr.resistances[1]?.price ?? entry + risk * 2.0;
    const target = roundMarketTick(Math.max(r2, entry + risk * 1.9), cur);
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      ...baseFields,
      setupType: "Near Resistance (R1)",
      entry,
      stop,
      target,
      rrRatio,
      reasonTh: `จ่อทดสอบแนวต้าน R1 ${r1.toFixed(2)} (ห่าง ${r1DistPct.toFixed(1)}%) หากเบรกพร้อมวอลุ่มลุ้นเป้า R2 ${target.toFixed(2)}`,
    };
  }

  // 5. Oversold ลุ้นรีบาวด์สั้น
  if (rsi14 <= 36) {
    const entry = roundMarketTick(price, cur);
    const stop = roundMarketTick(
      Math.max(price * 0.93, Math.min(prev20Low * 0.985, s1 * 0.985)),
      cur
    );
    const risk = Math.max(0.02, entry - stop);
    const target = roundMarketTick(Math.max(ema20, r1, entry + risk * 1.7), cur);
    const rrRatio = Number(((target - entry) / risk).toFixed(2));
    return {
      ...baseFields,
      setupType: "Oversold Rebound",
      entry,
      stop,
      target,
      rrRatio,
      reasonTh: `RSI(14) ลงเขตขายมากเกินไป (${rsi14.toFixed(1)}) ใกล้แนวรับ S1 ${s1.toFixed(2)} ลุ้นรีบาวด์กลับ EMA20`,
    };
  }

  return null;
}
