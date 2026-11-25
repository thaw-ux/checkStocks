import type { OhlcvBar, TimeMachineHorizon, TimeMachineResult } from "../types";

export interface BoardLotSizing {
  shares: number; // multiples of 100
  positionValue: number;
  portfolioAllocPct: number;
  maxLossBaht: number;
  targetGainBaht: number;
  riskPerShare: number;
  rewardPerShare: number;
  rrRatio: number;
  copySnippet: string;
}

export function calcBoardLotSizing(params: {
  symbol: string;
  portfolioBaht: number;
  riskPct: number;
  entry: number;
  stop: number;
  target: number;
  lotSize?: number;
  currency?: string;
}): BoardLotSizing {
  const {
    symbol,
    portfolioBaht,
    riskPct,
    entry,
    stop,
    target,
    lotSize = 1,
    currency = "USD",
  } = params;
  const riskPerShare = Math.max(0.01, entry - stop);
  const rewardPerShare = Math.max(0, target - entry);
  const rrRatio = Number((rewardPerShare / riskPerShare).toFixed(2));

  const maxRiskBudget = Math.max(0, portfolioBaht * (riskPct / 100));
  const rawSharesByRisk = Math.floor(maxRiskBudget / riskPerShare);
  const maxSharesByCash = entry > 0 ? Math.floor(portfolioBaht / entry) : 0;
  const cappedShares = Math.min(rawSharesByRisk, maxSharesByCash);
  const step = Math.max(1, lotSize);
  const shares = Math.max(0, Math.floor(cappedShares / step) * step);

  const positionValue = Number((shares * entry).toFixed(2));
  const portfolioAllocPct =
    portfolioBaht > 0 ? Number(((positionValue / portfolioBaht) * 100).toFixed(1)) : 0;
  const maxLossBaht = Number((shares * riskPerShare).toFixed(0));
  const targetGainBaht = Number((shares * rewardPerShare).toFixed(0));

  const unit = currency === "USD" ? "$" : currency === "HKD" ? "HK$" : currency === "CNY" ? "¥" : "฿";
  const copySnippet = `📌 แผนเทรด ${symbol} | BUY ${entry.toFixed(2)} | STOP ${stop.toFixed(2)} | TARGET ${target.toFixed(2)} (${unit}) | R:R 1:${rrRatio.toFixed(2)} | ขนาด ${shares.toLocaleString()} หุ้น (${positionValue.toLocaleString()} ${unit})`;

  return {
    shares,
    positionValue,
    portfolioAllocPct,
    maxLossBaht,
    targetGainBaht,
    riskPerShare: Number(riskPerShare.toFixed(2)),
    rewardPerShare: Number(rewardPerShare.toFixed(2)),
    rrRatio,
    copySnippet,
  };
}

// Fast deterministic PRNG (Mulberry32)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getHorizonConfig(horizon: TimeMachineHorizon): {
  steps: number;
  blockLen: number;
  label: string;
  unitLabel: string;
} {
  switch (horizon) {
    case "5d":
      return {
        steps: 5,
        blockLen: 2,
        label: "Swing 5 วันทำการ (เก็งกำไรระยะสั้น)",
        unitLabel: "D",
      };
    case "20d":
      return {
        steps: 20,
        blockLen: 3,
        label: "Swing 20 วันทำการ (ถือรอรอบ 1 เดือน)",
        unitLabel: "D",
      };
    case "1d_5m":
      return {
        steps: 60, // Global market intraday ~5h = 60 x 5-min bars
        blockLen: 4,
        label: "Intraday 1 วันทำการ (แท่ง 5 นาที · หุ้นใหญ่สภาพคล่องสูง)",
        unitLabel: "B",
      };
    case "10d":
    default:
      return {
        steps: 10,
        blockLen: 2,
        label: "Swing 10 วันทำการ (มาตรฐาน 2 สัปดาห์)",
        unitLabel: "D",
      };
  }
}

export function runTimeMachineSimulation(params: {
  symbol: string;
  bars: OhlcvBar[];
  entry: number;
  stop: number;
  target: number;
  horizon?: TimeMachineHorizon;
  simulations?: number;
}): TimeMachineResult {
  const startTime = performance.now();
  const {
    symbol,
    bars,
    entry,
    stop,
    target,
    horizon = "10d",
    simulations = 10_000,
  } = params;

  const cfg = getHorizonConfig(horizon);
  const steps = cfg.steps;
  const risk = Math.max(0.01, entry - stop);
  const reward = Math.max(0.01, target - entry);
  const rrRatio = Number((reward / risk).toFixed(2));

  // Extract empirical OHLC transition ratios from valid bars
  const validBars = bars.filter(
    (b) => b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0 && b.high >= b.low
  );

  const count = Math.max(0, validBars.length - 1);
  const gapRatios = new Float64Array(Math.max(count, 1));
  const highRatios = new Float64Array(Math.max(count, 1));
  const lowRatios = new Float64Array(Math.max(count, 1));
  const closeRatios = new Float64Array(Math.max(count, 1));

  if (count >= 5) {
    for (let i = 1; i < validBars.length; i++) {
      const prev = validBars[i - 1];
      const cur = validBars[i];
      // Clamp extreme corporate-action/split outliers (+/-15% per bar)
      const gap = Math.min(1.15, Math.max(0.85, cur.open / prev.close));
      const hi = Math.min(1.15, Math.max(1.0, cur.high / cur.open));
      const lo = Math.max(0.85, Math.min(1.0, cur.low / cur.open));
      const cl = Math.min(1.15, Math.max(0.85, cur.close / cur.open));
      gapRatios[i - 1] = gap;
      highRatios[i - 1] = hi;
      lowRatios[i - 1] = lo;
      closeRatios[i - 1] = cl;
    }
  } else {
    // Fallback neutral distribution if insufficient bars
    gapRatios[0] = 1.0;
    highRatios[0] = 1.015;
    lowRatios[0] = 0.985;
    closeRatios[0] = 1.0;
  }

  const nSamples = Math.max(count, 1);
  const rand = mulberry32(
    hashSeed(`${symbol}|${horizon}|${entry.toFixed(2)}|${stop.toFixed(2)}|${target.toFixed(2)}|${nSamples}`)
  );

  // Store prices per step across all simulations to compute exact percentile fan bands
  const stepColumns: Float64Array[] = Array.from(
    { length: steps + 1 },
    () => new Float64Array(simulations)
  );
  stepColumns[0].fill(entry);

  let hitTargetCount = 0;
  let hitStopCount = 0;
  let unresolvedCount = 0;
  let totalR = 0;

  const maxSampleTarget = 12;
  const maxSampleStop = 12;
  const maxSampleOpen = 10;
  const sampleTarget: number[][] = [];
  const sampleStop: number[][] = [];
  const sampleOpen: number[][] = [];

  const blockLen = Math.min(cfg.blockLen, nSamples);
  const maxStartIdx = Math.max(1, nSamples - blockLen + 1);

  for (let sim = 0; sim < simulations; sim++) {
    let price = entry;
    let outcome: "target" | "stop" | "open" = "open";
    let needPath = false;
    if (
      sampleTarget.length < maxSampleTarget ||
      sampleStop.length < maxSampleStop ||
      sampleOpen.length < maxSampleOpen
    ) {
      needPath = sim % 17 === 0 || sim < 120;
    }
    const path = needPath ? new Array<number>(steps + 1) : null;
    if (path) path[0] = entry;

    let blockRemaining = 0;
    let cursor = 0;

    for (let t = 1; t <= steps; t++) {
      if (outcome !== "open") {
        // Freeze price at hit level once exited
        stepColumns[t][sim] = price;
        if (path) path[t] = price;
        continue;
      }

      if (blockRemaining <= 0) {
        cursor = Math.floor(rand() * maxStartIdx);
        blockRemaining = blockLen;
      }
      const idx = cursor;
      cursor = (cursor + 1) % nSamples;
      blockRemaining--;

      const simOpen = price * gapRatios[idx];
      const simHigh = simOpen * highRatios[idx];
      const simLow = simOpen * lowRatios[idx];
      const simClose = simOpen * closeRatios[idx];

      // Check gap / intrabar target & stop
      if (simOpen <= stop) {
        outcome = "stop";
        price = simOpen;
      } else if (simOpen >= target) {
        outcome = "target";
        price = simOpen;
      } else {
        const touchedStop = simLow <= stop;
        const touchedTarget = simHigh >= target;
        if (touchedStop && touchedTarget) {
          // Conservative tie-break: red candle hits stop first, green hits target first
          if (simClose < simOpen) {
            outcome = "stop";
            price = stop;
          } else {
            outcome = "target";
            price = target;
          }
        } else if (touchedStop) {
          outcome = "stop";
          price = stop;
        } else if (touchedTarget) {
          outcome = "target";
          price = target;
        } else {
          price = simClose;
        }
      }

      stepColumns[t][sim] = price;
      if (path) path[t] = Number(price.toFixed(2));
    }

    if (outcome === "target") {
      hitTargetCount++;
      totalR += (price - entry) / risk;
      if (path && sampleTarget.length < maxSampleTarget) sampleTarget.push(path);
    } else if (outcome === "stop") {
      hitStopCount++;
      totalR += (price - entry) / risk; // negative (~ -1R)
      if (path && sampleStop.length < maxSampleStop) sampleStop.push(path);
    } else {
      unresolvedCount++;
      totalR += (price - entry) / risk;
      if (path && sampleOpen.length < maxSampleOpen) sampleOpen.push(path);
    }
  }

  // Compute percentile fan bands
  const percentileBands = stepColumns.map((col, step) => {
    col.sort();
    const at = (p: number) => Number(col[Math.min(simulations - 1, Math.floor(p * simulations))].toFixed(2));
    return {
      step,
      label: step === 0 ? "Entry" : `${cfg.unitLabel}${step}`,
      p10: at(0.1),
      p25: at(0.25),
      p50: at(0.5),
      p75: at(0.75),
      p90: at(0.9),
    };
  });

  // Historical Real-Chart Backcheck (non-overlapping or stepped real windows)
  const stopPctOffset = (entry - stop) / entry;
  const targetPctOffset = (target - entry) / entry;
  let histTotal = 0;
  let histTarget = 0;
  let histStop = 0;
  let histOpen = 0;

  const stride = Math.max(1, Math.floor(steps / 2));
  for (let i = 0; i + steps < validBars.length; i += stride) {
    const e0 = validBars[i].close;
    const s0 = e0 * (1 - stopPctOffset);
    const t0 = e0 * (1 + targetPctOffset);
    let res: "target" | "stop" | "open" = "open";
    for (let k = 1; k <= steps; k++) {
      const b = validBars[i + k];
      if (b.low <= s0 && b.high >= t0) {
        res = b.close < b.open ? "stop" : "target";
        break;
      }
      if (b.low <= s0) {
        res = "stop";
        break;
      }
      if (b.high >= t0) {
        res = "target";
        break;
      }
    }
    histTotal++;
    if (res === "target") histTarget++;
    else if (res === "stop") histStop++;
    else histOpen++;
  }

  const hitTargetPct = Number(((hitTargetCount / simulations) * 100).toFixed(1));
  const hitStopPct = Number(((hitStopCount / simulations) * 100).toFixed(1));
  const unresolvedPct = Number(((unresolvedCount / simulations) * 100).toFixed(1));
  const expectancyR = Number((totalR / simulations).toFixed(2));

  let verdictLabel = "พอๆ กับโยนเหรียญ (Coin Flip)";
  let verdictBias: "positive" | "neutral" | "negative" = "neutral";
  if (expectancyR >= 0.2 && hitTargetPct >= 45) {
    verdictLabel = "แผนได้เปรียบทางสถิติชัดเจน (Positive Edge)";
    verdictBias = "positive";
  } else if (expectancyR > 0.05) {
    verdictLabel = "ได้เปรียบเล็กน้อย (Slight Edge · คุมขนาดไม้)";
    verdictBias = "positive";
  } else if (expectancyR < -0.1 || hitStopPct > hitTargetPct * 1.4) {
    verdictLabel = "เสียเปรียบทางสถิติ (ควรปรับจุดเข้าหรือขยาย Stop)";
    verdictBias = "negative";
  }

  const samplePaths = [
    ...sampleTarget.map((prices) => ({ outcome: "target" as const, prices })),
    ...sampleStop.map((prices) => ({ outcome: "stop" as const, prices })),
    ...sampleOpen.map((prices) => ({ outcome: "open" as const, prices })),
  ];

  return {
    symbol,
    horizon,
    horizonLabel: cfg.label,
    steps,
    simulations,
    entry: Number(entry.toFixed(2)),
    stop: Number(stop.toFixed(2)),
    target: Number(target.toFixed(2)),
    rrRatio,
    hitTargetPct,
    hitStopPct,
    unresolvedPct,
    expectancyR,
    verdictLabel,
    verdictBias,
    percentileBands,
    samplePaths,
    historicalBackcheck: {
      totalCases: histTotal,
      hitTarget: histTarget,
      hitStop: histStop,
      unresolved: histOpen,
      winRatePct: histTotal > 0 ? Number(((histTarget / histTotal) * 100).toFixed(1)) : 0,
    },
    elapsedMs: Number((performance.now() - startTime).toFixed(1)),
  };
}
