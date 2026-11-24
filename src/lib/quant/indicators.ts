import type { OhlcvBar, StockTechnicalSummary } from "../types";

export function calcEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period <= 0) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  result[period - 1] = ema;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function calcSMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period <= 0) return result;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macd: (number | null)[] = closes.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i]! - emaSlow[i]! : null
  );

  const validMacdValues: number[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] !== null) {
      validMacdValues.push(macd[i]!);
      validIndices.push(i);
    }
  }

  const signalRaw = calcEMA(validMacdValues, signalPeriod);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  for (let j = 0; j < validIndices.length; j++) {
    const idx = validIndices[j];
    signal[idx] = signalRaw[j];
    if (macd[idx] !== null && signalRaw[j] !== null) {
      histogram[idx] = macd[idx]! - signalRaw[j]!;
    }
  }

  return { macd, signal, histogram };
}

export function calcATR(bars: OhlcvBar[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length <= period) return result;
  const trs: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - prevClose),
      Math.abs(bars[i].low - prevClose)
    );
    trs.push(tr);
  }
  let atr = 0;
  for (let i = 1; i <= period; i++) atr += trs[i];
  atr /= period;
  result[period] = atr;
  for (let i = period + 1; i < bars.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result[i] = atr;
  }
  return result;
}

/** Round to valid Thai SET tick size */
export function roundSetTick(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  let tick = 0.01;
  if (price < 2) tick = 0.01;
  else if (price < 5) tick = 0.02;
  else if (price < 10) tick = 0.05;
  else if (price < 25) tick = 0.1;
  else if (price < 100) tick = 0.25;
  else if (price < 200) tick = 0.5;
  else if (price < 400) tick = 1.0;
  else tick = 2.0;

  return Number((Math.round(price / tick) * tick).toFixed(2));
}

export function computeTechnicalSummary(bars: OhlcvBar[]): StockTechnicalSummary {
  if (bars.length === 0) {
    return {
      price: 0,
      prevClose: 0,
      change: 0,
      changePct: 0,
      ema20: null,
      ema50: null,
      ema200: null,
      rsi14: null,
      macd: null,
      macdSignal: null,
      macdHist: null,
      atr14: null,
      volMa20: null,
      volRatio: null,
      s1: 0,
      s2: 0,
      r1: 0,
      r2: 0,
      standardStop: 0,
      shortTarget: 0,
      trendLabel: "ไม่มีข้อมูลกราฟ",
      trendBias: "neutral",
      candleTimestamp: new Date().toISOString(),
    };
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const n = bars.length;
  const last = bars[n - 1];
  const prev = n >= 2 ? bars[n - 2] : last;

  const ema20Arr = calcEMA(closes, 20);
  const ema50Arr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);
  const rsiArr = calcRSI(closes, 14);
  const macdObj = calcMACD(closes, 12, 26, 9);
  const atrArr = calcATR(bars, 14);
  const volMa20Arr = calcSMA(volumes, 20);

  const ema20 = ema20Arr[n - 1];
  const ema50 = ema50Arr[n - 1];
  const ema200 = ema200Arr[n - 1];
  const rsi14 = rsiArr[n - 1];
  const atr14 = atrArr[n - 1] ?? Math.max(last.high - last.low, last.close * 0.02);
  const volMa20 = volMa20Arr[n - 1];
  const volRatio = volMa20 && volMa20 > 0 ? last.volume / volMa20 : null;

  // Support / Resistance from recent 20D & 60D windows
  const recent20 = bars.slice(-Math.min(20, n));
  const recent60 = bars.slice(-Math.min(60, n));
  const low20 = Math.min(...recent20.map((b) => b.low));
  const high20 = Math.max(...recent20.map((b) => b.high));
  const low60 = Math.min(...recent60.map((b) => b.low));
  const high60 = Math.max(...recent60.map((b) => b.high));

  const price = last.close;
  const s1Raw = low20 < price * 0.99 ? low20 : price - atr14 * 1.2;
  const s2Raw = low60 < s1Raw * 0.99 ? low60 : s1Raw - atr14 * 1.2;
  const r1Raw = high20 > price * 1.01 ? high20 : price + atr14 * 1.8;
  const r2Raw = high60 > r1Raw * 1.01 ? high60 : r1Raw + atr14 * 1.8;

  const s1 = roundSetTick(Math.max(0.01, s1Raw));
  const s2 = roundSetTick(Math.max(0.01, s2Raw));
  const r1 = roundSetTick(r1Raw);
  const r2 = roundSetTick(r2Raw);

  // Standard 10D swing stop: anchored to ~1.6x ATR (or nearby S1 if within 2.5x ATR), clamped to 2.5%-6% risk
  const atrStop = price - Math.max(atr14 * 1.6, price * 0.025);
  const s1IsNearby = s1 < price - atr14 * 0.6 && s1 >= price - atr14 * 2.6;
  const rawStop = s1IsNearby ? Math.min(s1 * 0.995, atrStop) : atrStop;
  const standardStop = roundSetTick(
    Math.max(price * 0.94, Math.min(price * 0.975, rawStop))
  );

  // Realistic 10D swing target: use R1 if it sits within a reachable swing range (1.3R .. 4.5x ATR), otherwise ~1.8R
  const risk = Math.max(price - standardStop, price * 0.02);
  const targetByRisk = price + risk * 1.8;
  const r1IsReachable = r1 >= price + risk * 1.3 && r1 <= price + Math.max(atr14 * 4.5, risk * 2.5);
  const shortTarget = roundSetTick(r1IsReachable ? r1 : targetByRisk);

  // Trend classification
  let trendLabel = "แกว่งออกข้าง (Sideways)";
  let trendBias: "bullish" | "neutral" | "bearish" = "neutral";
  if (ema200 !== null && ema50 !== null) {
    if (price > ema200 && ema50 > ema200 && (ema20 === null || price >= ema20 * 0.99)) {
      trendLabel = "ขาขึ้นแข็งแกร่ง (เหนือ EMA20/50/200)";
      trendBias = "bullish";
    } else if (price > ema200) {
      trendLabel = "พักตัวบนแนวโน้มขาขึ้น (เหนือ EMA200)";
      trendBias = "bullish";
    } else if (price < ema200 && ema50 < ema200) {
      trendLabel = "แนวโน้มขาลง (ใต้ EMA50/200)";
      trendBias = "bearish";
    } else {
      trendLabel = "ฟื้นตัวทดสอบแนวต้านสำคัญ (ใต้ EMA200)";
      trendBias = "neutral";
    }
  } else if (ema20 !== null) {
    if (price > ema20) {
      trendLabel = "โมเมนตัมระยะสั้นเชิงบวก (เหนือ EMA20)";
      trendBias = "bullish";
    } else {
      trendLabel = "โมเมนตัมระยะสั้นอ่อนตัว (ใต้ EMA20)";
      trendBias = "bearish";
    }
  }

  const change = Number((price - prev.close).toFixed(2));
  const changePct = prev.close > 0 ? Number(((change / prev.close) * 100).toFixed(2)) : 0;

  return {
    price: Number(price.toFixed(2)),
    prevClose: Number(prev.close.toFixed(2)),
    change,
    changePct,
    ema20: ema20 !== null ? Number(ema20.toFixed(2)) : null,
    ema50: ema50 !== null ? Number(ema50.toFixed(2)) : null,
    ema200: ema200 !== null ? Number(ema200.toFixed(2)) : null,
    rsi14: rsi14 !== null ? Number(rsi14.toFixed(1)) : null,
    macd: macdObj.macd[n - 1] !== null ? Number(macdObj.macd[n - 1]!.toFixed(3)) : null,
    macdSignal:
      macdObj.signal[n - 1] !== null ? Number(macdObj.signal[n - 1]!.toFixed(3)) : null,
    macdHist:
      macdObj.histogram[n - 1] !== null ? Number(macdObj.histogram[n - 1]!.toFixed(3)) : null,
    atr14: Number(atr14.toFixed(2)),
    volMa20: volMa20 !== null ? Math.round(volMa20) : null,
    volRatio: volRatio !== null ? Number(volRatio.toFixed(2)) : null,
    s1,
    s2,
    r1,
    r2,
    standardStop,
    shortTarget,
    trendLabel,
    trendBias,
    candleTimestamp: last.time,
  };
}
