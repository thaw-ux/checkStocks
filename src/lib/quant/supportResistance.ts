import type {
  FibLevel,
  OhlcvBar,
  SupportResistanceLevel,
  SupportResistanceMap,
} from "../types";
import { calcATR, calcEMA, roundMarketTick } from "./indicators";

function getIsoWeekMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Aggregate daily OHLCV bars into exact ISO-week candles */
export function aggregateWeeklyBars(dailyBars: OhlcvBar[]): OhlcvBar[] {
  if (dailyBars.length === 0) return [];
  const buckets = new Map<string, OhlcvBar[]>();
  for (const b of dailyBars) {
    const mon = getIsoWeekMonday(b.time);
    const list = buckets.get(mon);
    if (list) list.push(b);
    else buckets.set(mon, [b]);
  }

  const weeks: OhlcvBar[] = [];
  for (const [, bars] of Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const first = bars[0];
    const last = bars[bars.length - 1];
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const b of bars) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
    }
    weeks.push({
      time: last.time,
      timestamp: last.timestamp,
      open: first.open,
      high,
      low,
      close: last.close,
      volume: Math.round(volume),
    });
  }
  return weeks;
}

interface RawCandidate {
  price: number;
  zoneLow: number;
  zoneHigh: number;
  swingHighHits: number;
  swingLowHits: number;
  sources: Set<string>;
  bonusScore: number;
}

function mergeCandidate(
  clusters: RawCandidate[],
  price: number,
  tolerance: number,
  source: string,
  meta: { isHigh?: boolean; isLow?: boolean; bonus?: number } = {}
) {
  if (!Number.isFinite(price) || price <= 0) return;
  let matched: RawCandidate | null = null;
  let bestDist = Infinity;

  for (const c of clusters) {
    const dist = Math.abs(c.price - price);
    if (dist <= tolerance && dist < bestDist) {
      bestDist = dist;
      matched = c;
    }
  }

  if (matched) {
    const totalW = matched.sources.size + 1;
    matched.price = (matched.price * matched.sources.size + price) / totalW;
    matched.zoneLow = Math.min(matched.zoneLow, price);
    matched.zoneHigh = Math.max(matched.zoneHigh, price);
    matched.sources.add(source);
    if (meta.isHigh) matched.swingHighHits++;
    if (meta.isLow) matched.swingLowHits++;
    matched.bonusScore += meta.bonus ?? 0;
  } else {
    clusters.push({
      price,
      zoneLow: price,
      zoneHigh: price,
      swingHighHits: meta.isHigh ? 1 : 0,
      swingLowHits: meta.isLow ? 1 : 0,
      sources: new Set([source]),
      bonusScore: meta.bonus ?? 0,
    });
  }
}

function computeVolumeProfile(bars: OhlcvBar[], numBins = 36): {
  pocPrice: number;
  hvnPrices: number[];
} {
  let minLow = Infinity;
  let maxHigh = -Infinity;
  for (const b of bars) {
    if (b.low < minLow) minLow = b.low;
    if (b.high > maxHigh) maxHigh = b.high;
  }
  if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh) || maxHigh <= minLow) {
    const fallback = bars[bars.length - 1]?.close ?? 0;
    return { pocPrice: fallback, hvnPrices: [] };
  }

  const binSize = (maxHigh - minLow) / numBins;
  const binVol = new Float64Array(numBins);

  for (const b of bars) {
    const weightVol = b.volume > 0 ? b.volume : 1; // works for zero-volume indices (^GSPC/^SET) using time-at-price TPO!
    const loIdx = Math.max(0, Math.min(numBins - 1, Math.floor((b.low - minLow) / binSize)));
    const hiIdx = Math.max(0, Math.min(numBins - 1, Math.floor((b.high - minLow) / binSize)));
    const span = Math.max(1, hiIdx - loIdx + 1);
    const share = weightVol / span;
    for (let k = loIdx; k <= hiIdx; k++) {
      binVol[k] += share;
    }
  }

  let pocIdx = 0;
  for (let i = 1; i < numBins; i++) {
    if (binVol[i] > binVol[pocIdx]) pocIdx = i;
  }
  const pocPrice = minLow + (pocIdx + 0.5) * binSize;

  // Find up to 2 secondary High-Volume Nodes spaced at least 3 bins apart
  const rankedBins = Array.from({ length: numBins }, (_, i) => ({
    idx: i,
    vol: binVol[i],
    price: minLow + (i + 0.5) * binSize,
  })).sort((a, b) => b.vol - a.vol);

  const chosenIndices = [pocIdx];
  const hvnPrices: number[] = [];
  for (const bin of rankedBins) {
    if (chosenIndices.every((ci) => Math.abs(ci - bin.idx) >= 4)) {
      chosenIndices.push(bin.idx);
      hvnPrices.push(bin.price);
      if (hvnPrices.length >= 2) break;
    }
  }

  return { pocPrice, hvnPrices };
}

function countPriceTouches(bars: OhlcvBar[], level: number, band: number): number {
  let touches = 0;
  let lastTouchIdx = -10;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (b.low - band <= level && b.high + band >= level) {
      if (i - lastTouchIdx >= 3) {
        touches++;
        lastTouchIdx = i;
      }
    }
  }
  return touches;
}

export function computeSmartSupportResistance(
  rawBars: OhlcvBar[],
  currency = "THB",
  timeframe: "day" | "week" = "day"
): SupportResistanceMap {
  const lookbackMax = timeframe === "day" ? 260 : 110;
  const bars = rawBars.slice(-Math.min(lookbackMax, rawBars.length));

  if (bars.length < 10) {
    const lastPrice = bars[bars.length - 1]?.close ?? 0;
    return {
      timeframe,
      price: lastPrice,
      pocPrice: lastPrice,
      supports: [],
      resistances: [],
      fibLevels: [],
      fibSwingHigh: lastPrice,
      fibSwingLow: lastPrice,
      nearestSupportDistPct: null,
      nearestResistanceDistPct: null,
      zonePositionPct: 50,
      zoneLabelTh: "ข้อมูลแท่งเทียนไม่เพียงพอ",
    };
  }

  const n = bars.length;
  const price = bars[n - 1].close;
  const closes = bars.map((b) => b.close);
  const atrArr = calcATR(bars, 14);
  const atr = atrArr[n - 1] ?? Math.max(price * 0.02, 0.05);

  const clusterTol =
    timeframe === "day"
      ? Math.max(price * 0.013, atr * 0.7)
      : Math.max(price * 0.022, atr * 0.65);

  const clusters: RawCandidate[] = [];

  // 1. Fractal Swing Pivots (minor + major windows)
  const windows =
    timeframe === "day"
      ? [
          { w: 4, bonus: 0.4 },
          { w: 9, bonus: 1.0 },
        ]
      : [
          { w: 2, bonus: 0.5 },
          { w: 4, bonus: 1.1 },
        ];

  for (const { w, bonus } of windows) {
    for (let i = w; i < n - w; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = i - w; j <= i + w; j++) {
        if (j === i) continue;
        if (bars[j].high > bars[i].high) isHigh = false;
        if (bars[j].low < bars[i].low) isLow = false;
      }
      if (isHigh) {
        mergeCandidate(clusters, bars[i].high, clusterTol, "Swing Pivot", {
          isHigh: true,
          bonus,
        });
      }
      if (isLow) {
        mergeCandidate(clusters, bars[i].low, clusterTol, "Swing Pivot", {
          isLow: true,
          bonus,
        });
      }
    }
  }

  // 2. Volume Profile (POC & HVN)
  const { pocPrice: rawPoc, hvnPrices } = computeVolumeProfile(bars, 36);
  const pocPrice = roundMarketTick(rawPoc, currency);
  mergeCandidate(clusters, pocPrice, clusterTol, "Volume POC", { bonus: 1.3 });
  for (const hvn of hvnPrices) {
    mergeCandidate(clusters, hvn, clusterTol, "High Volume", { bonus: 0.8 });
  }

  // 3. Fibonacci Retracement over major swing range (recent 120D or full weekly window)
  const fibBars = bars.slice(-Math.min(timeframe === "day" ? 130 : 65, n));
  let fibHighIdx = 0;
  let fibLowIdx = 0;
  for (let i = 1; i < fibBars.length; i++) {
    if (fibBars[i].high > fibBars[fibHighIdx].high) fibHighIdx = i;
    if (fibBars[i].low < fibBars[fibLowIdx].low) fibLowIdx = i;
  }
  const fibSwingHigh = roundMarketTick(fibBars[fibHighIdx].high, currency);
  const fibSwingLow = roundMarketTick(fibBars[fibLowIdx].low, currency);
  const fibSpan = Math.max(0.01, fibSwingHigh - fibSwingLow);
  const isUptrendSwing = fibHighIdx >= fibLowIdx;

  const fibRatios: { ratio: number; label: string; keyLevel: boolean }[] = [
    { ratio: 0.236, label: "Fib 23.6%", keyLevel: false },
    { ratio: 0.382, label: "Fib 38.2%", keyLevel: true },
    { ratio: 0.5, label: "Fib 50.0%", keyLevel: true },
    { ratio: 0.618, label: "Fib 61.8%", keyLevel: true },
    { ratio: 0.786, label: "Fib 78.6%", keyLevel: false },
  ];

  const fibLevels: FibLevel[] = fibRatios.map((f) => {
    const rawLevel = isUptrendSwing
      ? fibSwingHigh - fibSpan * f.ratio
      : fibSwingLow + fibSpan * f.ratio;
    const lvlPrice = roundMarketTick(rawLevel, currency);
    if (f.keyLevel) {
      mergeCandidate(clusters, lvlPrice, clusterTol, f.label, { bonus: 0.85 });
    }
    return {
      ratio: f.ratio,
      label: f.label,
      price: lvlPrice,
    };
  });

  // 4. Dynamic EMA 50 & EMA 200 Confluence
  const ema20 = calcEMA(closes, 20)[n - 1];
  const ema50 = calcEMA(closes, 50)[n - 1];
  const ema200 = calcEMA(closes, Math.min(200, n - 1))[n - 1];
  if (ema50) mergeCandidate(clusters, ema50, clusterTol, "EMA 50", { bonus: 0.7 });
  if (ema200 && n >= 100) mergeCandidate(clusters, ema200, clusterTol, "EMA 200", { bonus: 1.1 });
  if (ema20 && timeframe === "week") mergeCandidate(clusters, ema20, clusterTol, "EMA 20W", { bonus: 0.6 });

  // Score every cluster cleanly (1 to 5 stars)
  const touchBand = clusterTol * 0.45;
  const scored = clusters.map((c) => {
    const center = roundMarketTick(c.price, currency);
    const touches = countPriceTouches(bars, center, touchBand);
    const roleFlip = c.swingHighHits > 0 && c.swingLowHits > 0;
    const sources = Array.from(c.sources);
    if (roleFlip && !sources.includes("Role Flip")) {
      sources.unshift("Role Flip");
    }

    let rawStrength = 1.2 + c.bonusScore;
    if (touches >= 5) rawStrength += 1.5;
    else if (touches >= 3) rawStrength += 0.9;
    else if (touches >= 2) rawStrength += 0.4;
    if (roleFlip) rawStrength += 0.9;
    if (sources.length >= 3) rawStrength += 0.7;

    const strength = Math.max(1, Math.min(5, Math.round(rawStrength)));
    const zPad = Math.max(price * 0.003, (c.zoneHigh - c.zoneLow) * 0.4);
    const zoneLow = roundMarketTick(Math.max(0.01, Math.min(c.zoneLow, center - zPad)), currency);
    const zoneHigh = roundMarketTick(Math.max(c.zoneHigh, center + zPad), currency);

    return {
      price: center,
      zoneLow,
      zoneHigh,
      touches,
      strength,
      roleFlip,
      sources: sources.slice(0, 4),
    };
  });

  const minSpacing =
    timeframe === "day"
      ? Math.max(price * 0.018, atr * 0.95)
      : Math.max(price * 0.032, atr * 0.85);

  function selectTopTiers(
    kind: "support" | "resistance"
  ): SupportResistanceLevel[] {
    const filtered = scored
      .filter((s) =>
        kind === "support" ? s.price < price * 0.995 : s.price > price * 1.005
      )
      .sort((a, b) =>
        kind === "support" ? b.price - a.price : a.price - b.price
      );

    // Greedily pick levels spaced at least minSpacing apart, swapping if a nearby level is much stronger
    const picked: typeof filtered = [];
    for (const cand of filtered) {
      const clashIdx = picked.findIndex((p) => Math.abs(p.price - cand.price) < minSpacing);
      if (clashIdx === -1) {
        picked.push(cand);
      } else if (cand.strength > picked[clashIdx].strength + 1) {
        picked[clashIdx] = cand;
      }
      if (picked.length >= 3) break;
    }

    // Re-sort nearest first (S1 closest below, R1 closest above)
    picked.sort((a, b) => (kind === "support" ? b.price - a.price : a.price - b.price));

    // Guarantee at least 2 tiers using ATR extension fallback (e.g. at ATH or ATL)
    while (picked.length < 2) {
      const idx = picked.length + 1;
      const anchor = picked.length > 0 ? picked[picked.length - 1].price : price;
      const fallbackPrice = roundMarketTick(
        kind === "support"
          ? Math.max(0.01, anchor - Math.max(atr * 1.8 * idx * 0.7, price * 0.035))
          : anchor + Math.max(atr * 1.8 * idx * 0.7, price * 0.035),
        currency
      );
      picked.push({
        price: fallbackPrice,
        zoneLow: roundMarketTick(Math.max(0.01, fallbackPrice * 0.992), currency),
        zoneHigh: roundMarketTick(fallbackPrice * 1.008, currency),
        touches: 0,
        strength: 2,
        roleFlip: false,
        sources: ["ATR Extension"],
      });
    }

    return picked.slice(0, 3).map((item, idx) => {
      const label = kind === "support" ? `S${idx + 1}` : `R${idx + 1}`;
      const distancePct =
        price > 0
          ? Number(
              (
                ((kind === "support" ? price - item.price : item.price - price) / price) *
                100
              ).toFixed(2)
            )
          : 0;
      return {
        label,
        kind,
        price: item.price,
        zoneLow: item.zoneLow,
        zoneHigh: item.zoneHigh,
        distancePct,
        touches: item.touches,
        strength: item.strength,
        roleFlip: item.roleFlip,
        sources: item.sources,
      };
    });
  }

  const supports = selectTopTiers("support");
  const resistances = selectTopTiers("resistance");

  const s1 = supports[0];
  const r1 = resistances[0];
  const nearestSupportDistPct = s1 ? s1.distancePct : null;
  const nearestResistanceDistPct = r1 ? r1.distancePct : null;

  let zonePositionPct = 50;
  if (s1 && r1 && r1.price > s1.price) {
    zonePositionPct = Math.max(
      0,
      Math.min(100, Math.round(((price - s1.price) / (r1.price - s1.price)) * 100))
    );
  }

  let zoneLabelTh = "โซนกลางกรอบ S1–R1 (รอดูทิศทาง)";
  if (nearestSupportDistPct !== null && nearestSupportDistPct <= 2.5) {
    zoneLabelTh = `ชิดแนวรับสำคัญ S1 (ห่างเพียง ${nearestSupportDistPct.toFixed(1)}%)`;
  } else if (nearestResistanceDistPct !== null && nearestResistanceDistPct <= 2.5) {
    zoneLabelTh = `จ่อทดสอบแนวต้านสำคัญ R1 (ห่างเพียง ${nearestResistanceDistPct.toFixed(1)}%)`;
  } else if (zonePositionPct <= 30) {
    zoneLabelTh = "อยู่โซนล่างใกล้แนวรับ S1 (ได้เปรียบความเสี่ยง)";
  } else if (zonePositionPct >= 70) {
    zoneLabelTh = "อยู่โซนบนใกล้แนวต้าน R1 (ระวังแรงขายทำกำไร)";
  }

  return {
    timeframe,
    price: roundMarketTick(price, currency),
    pocPrice,
    supports,
    resistances,
    fibLevels,
    fibSwingHigh,
    fibSwingLow,
    nearestSupportDistPct,
    nearestResistanceDistPct,
    zonePositionPct,
    zoneLabelTh,
  };
}
