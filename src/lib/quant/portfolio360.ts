import type {
  CurrencyCode,
  DimensionScore,
  EmergencyAlertItem,
  IaaConsensusSummary,
  MarketId,
  OhlcvBar,
  WeeklyBacktestPoint,
  WeeklyPortfolioPayload,
  WeeklyPortfolioPick,
} from "../types";
import { MARKET_CONFIGS, resolveStockSymbol } from "../markets";
import { calcATR, calcEMA, calcRSI, calcSMA, roundMarketTick } from "./indicators";
import { runTimeMachineSimulation } from "./timeMachine";

export interface StockUniverseBundle {
  symbol: string;
  bars: OhlcvBar[];
  iaa?: IaaConsensusSummary | null;
  newsSentiment?: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function scoreStock5Dimensions(params: {
  symbol: string;
  market?: MarketId;
  bars: OhlcvBar[];
  setBars: OhlcvBar[];
  iaa?: IaaConsensusSummary | null;
  newsSentiment?: number;
  simulations?: number;
}): {
  scores: DimensionScore;
  entry: number;
  stop: number;
  target: number;
  rrRatio: number;
  winRate5dPct: number;
  expectancy5dR: number;
  rationaleTh: string;
} | null {
  const { symbol, market = "NASDAQ100", bars, setBars, iaa, newsSentiment = 0, simulations = 2000 } = params;
  if (bars.length < 40) return null;

  const meta = resolveStockSymbol(symbol, market);
  const cur = meta.currency;
  const n = bars.length;
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const last = bars[n - 1];
  const price = last.close;

  const ema20 = calcEMA(closes, 20)[n - 1] ?? price;
  const ema50 = calcEMA(closes, 50)[n - 1] ?? price;
  const ema200 = calcEMA(closes, Math.min(200, n - 1))[n - 1] ?? ema50;
  const rsi14 = calcRSI(closes, 14)[n - 1] ?? 50;
  const atr14 = calcATR(bars, 14)[n - 1] ?? price * 0.02;
  const volMa20 = calcSMA(volumes, 20)[n - 1] ?? last.volume;
  const volRatio = volMa20 > 0 ? last.volume / volMa20 : 1;

  // 1. Fundamental & Analyst Consensus (0-20)
  let dim1 = 10;
  if (iaa && iaa.upsidePct !== null) {
    const upsidePts = clamp((iaa.upsidePct + 5) / 2.5, 0, 12);
    const buyRatioPts = iaa.buyRatioPct !== null ? clamp((iaa.buyRatioPct / 100) * 8, 0, 8) : 4;
    dim1 = Number((upsidePts + buyRatioPts).toFixed(1));
  } else {
    const high60 = Math.max(...bars.slice(-60).map((b) => b.high));
    const drawdownFromHigh = high60 > 0 ? ((high60 - price) / high60) * 100 : 0;
    dim1 = Number(clamp(12 - Math.abs(drawdownFromHigh - 10) * 0.3, 6, 15).toFixed(1));
  }

  // 2. Technical Trend & Structure (0-20)
  let dim2 = 0;
  if (price > ema200) dim2 += 7;
  if (ema50 > ema200) dim2 += 5;
  if (price > ema20) dim2 += 4;
  if (ema20 > ema50) dim2 += 4;
  dim2 = Number(clamp(dim2, 0, 20).toFixed(1));

  // 3. Momentum, Volume & Relative Strength vs Benchmark (0-20)
  const stockRet10 = n > 10 ? ((price - closes[n - 11]) / closes[n - 11]) * 100 : 0;
  const setN = setBars.length;
  const setRet10 =
    setN > 10 ? ((setBars[setN - 1].close - setBars[setN - 11].close) / setBars[setN - 11].close) * 100 : 0;
  const relStrength = stockRet10 - setRet10;

  let rsiPts = 5;
  if (rsi14 >= 50 && rsi14 <= 68) rsiPts = 8;
  else if (rsi14 >= 42 && rsi14 < 50) rsiPts = 6;
  else if (rsi14 > 68 && rsi14 <= 76) rsiPts = 4;
  else if (rsi14 < 36) rsiPts = 6;
  else rsiPts = 2;

  const volPts = clamp(volRatio * 4, 2, 6);
  const rsPts = clamp(3 + relStrength * 0.6, 0, 6);
  const dim3 = Number(clamp(rsiPts + volPts + rsPts, 0, 20).toFixed(1));

  // Disciplined 5-day swing plan
  const entry = roundMarketTick(price, cur);
  const stop = roundMarketTick(
    Math.max(price * 0.935, price - Math.max(atr14 * 1.4, price * 0.025)),
    cur
  );
  const risk = Math.max(0.02, entry - stop);
  const target = roundMarketTick(entry + risk * 1.85, cur);
  const rrRatio = Number(((target - entry) / risk).toFixed(2));

  // 4. Time Machine 5-Day Edge (0-20)
  const tm = runTimeMachineSimulation({
    symbol,
    bars: bars.slice(-260),
    entry,
    stop,
    target,
    horizon: "5d",
    simulations,
  });
  const winPts = clamp((tm.hitTargetPct - 20) * 0.3, 0, 12);
  const expPts = clamp((tm.expectancyR + 0.2) * 16, 0, 8);
  const dim4 = Number(clamp(winPts + expPts, 0, 20).toFixed(1));

  // 5. Risk Stability & Sentiment (0-20)
  const atrPct = price > 0 ? (atr14 / price) * 100 : 2;
  const idealMaxAtr = market === "DR" ? 3.6 : 4.4;
  const volStability =
    atrPct <= idealMaxAtr
      ? clamp(14 - Math.abs(atrPct - 2.0) * 2.2, 8, 14)
      : clamp(14 - (atrPct - idealMaxAtr) * 2.5, 2, 10);
  const overboughtPenalty = rsi14 > 78 ? -4 : 0;
  const sentPts = clamp(3 + newsSentiment * 3, 0, 6);
  const dim5 = Number(clamp(volStability + sentPts + overboughtPenalty, 0, 20).toFixed(1));

  const total = Number((dim1 + dim2 + dim3 + dim4 + dim5).toFixed(1));

  const reasons: string[] = [];
  if (price > ema200) reasons.push("ยืนเหนือ EMA200");
  if (iaa?.upsidePct && iaa.upsidePct > 8) reasons.push(`Upside เป้าเฉลี่ย +${iaa.upsidePct.toFixed(1)}%`);
  if (relStrength > 1.5) reasons.push(`แกร่งกว่าดัชนี +${relStrength.toFixed(1)}%`);
  if (tm.expectancyR > 0) reasons.push(`Time Machine 5D +${tm.expectancyR.toFixed(2)}R`);
  if (reasons.length === 0) reasons.push(`คะแนนรวม 5 มิติ ${total}/100 สมดุลความเสี่ยงดี`);

  return {
    scores: {
      fundamentalIaa: dim1,
      technicalTrend: dim2,
      momentumVolume: dim3,
      timeMachineEdge: dim4,
      riskStability: dim5,
      total,
    },
    entry,
    stop,
    target,
    rrRatio,
    winRate5dPct: tm.hitTargetPct,
    expectancy5dR: tm.expectancyR,
    rationaleTh: reasons.join(" · "),
  };
}

function getIsoWeekMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function buildWeeklyPortfolio360(params: {
  universe: StockUniverseBundle[];
  setBars: OhlcvBar[];
  market?: MarketId;
  baseCapital?: number;
}): WeeklyPortfolioPayload {
  const { universe, setBars, market = "NASDAQ100" } = params;
  const mCfg = MARKET_CONFIGS[market];
  const baseCapital = params.baseCapital ?? mCfg.defaultCapital;
  const portfolioCurrency: CurrencyCode = mCfg.defaultCurrency;

  const latestSetDate = setBars[setBars.length - 1]?.time ?? new Date().toISOString().slice(0, 10);
  const currentMonday = getIsoWeekMonday(latestSetDate);

  const scored: {
    symbol: string;
    bars: OhlcvBar[];
    iaa?: IaaConsensusSummary | null;
    anchorPrice: number;
    currentPrice: number;
    changePct: number;
    evalResult: NonNullable<ReturnType<typeof scoreStock5Dimensions>>;
  }[] = [];

  for (const item of universe) {
    if (item.bars.length < 45) continue;
    const preWeekBars = item.bars.filter((b) => b.time < currentMonday);
    const weekBars = item.bars.filter((b) => b.time >= currentMonday);
    const evalBars = preWeekBars.length >= 40 ? preWeekBars : item.bars;

    const evalResult = scoreStock5Dimensions({
      symbol: item.symbol,
      market,
      bars: evalBars,
      setBars:
        setBars.filter((b) => b.time < currentMonday).length >= 20
          ? setBars.filter((b) => b.time < currentMonday)
          : setBars,
      iaa: item.iaa,
      newsSentiment: item.newsSentiment,
      simulations: 1500,
    });
    if (!evalResult) continue;

    const lastBar = item.bars[item.bars.length - 1];
    const prevBar = item.bars[item.bars.length - 2] ?? lastBar;
    const anchorBar = weekBars.length > 0 ? weekBars[0] : lastBar;
    const anchorPrice = anchorBar.open > 0 ? anchorBar.open : anchorBar.close;
    const changePct = prevBar.close > 0 ? ((lastBar.close - prevBar.close) / prevBar.close) * 100 : 0;

    scored.push({
      symbol: item.symbol,
      bars: item.bars,
      iaa: item.iaa,
      anchorPrice: Number(anchorPrice.toFixed(2)),
      currentPrice: Number(lastBar.close.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
      evalResult,
    });
  }

  scored.sort((a, b) => b.evalResult.scores.total - a.evalResult.scores.total);

  const top5: typeof scored = [];
  const sectorCounts = new Map<string, number>();
  for (const cand of scored) {
    const meta = resolveStockSymbol(cand.symbol, market);
    const count = sectorCounts.get(meta.sector) ?? 0;
    if (count >= 2 && scored.length >= 10) continue;
    top5.push(cand);
    sectorCounts.set(meta.sector, count + 1);
    if (top5.length === 5) break;
  }

  const perStockAlloc = baseCapital / Math.max(1, top5.length);
  const emergencyAlerts: EmergencyAlertItem[] = [];

  const picks: WeeklyPortfolioPick[] = top5.map((item, idx) => {
    const meta = resolveStockSymbol(item.symbol, market);
    const entry = roundMarketTick(item.anchorPrice, meta.currency);
    const atr = calcATR(item.bars.slice(-30), 14).at(-1) ?? entry * 0.02;
    const stopLoss = roundMarketTick(
      Math.max(entry * 0.935, entry - Math.max(atr * 1.4, entry * 0.025)),
      meta.currency
    );
    const risk = Math.max(0.02, entry - stopLoss);
    const targetPrice = roundMarketTick(entry + risk * 1.85, meta.currency);
    const rrRatio = Number(((targetPrice - entry) / risk).toFixed(2));

    const tmFull = runTimeMachineSimulation({
      symbol: item.symbol,
      bars: item.bars.slice(-260),
      entry,
      stop: stopLoss,
      target: targetPrice,
      horizon: "5d",
      simulations: 10_000,
    });

    const step = meta.lotSize;
    const sharesBoardLot =
      entry > 0 ? Math.max(step, Math.floor(perStockAlloc / entry / step) * step) : step;
    const allocatedBaht = Number((sharesBoardLot * entry).toFixed(0));
    const pnlPct = entry > 0 ? Number((((item.currentPrice - entry) / entry) * 100).toFixed(2)) : 0;
    const pnlBaht = Number(((item.currentPrice - entry) * sharesBoardLot).toFixed(0));

    let status: WeeklyPortfolioPick["status"] = "active";
    if (item.currentPrice >= targetPrice) {
      status = "hit_target";
    } else if (item.currentPrice <= stopLoss) {
      status = "hit_stop";
      emergencyAlerts.push({
        symbol: item.symbol,
        severity: "critical",
        title: `${item.symbol} หลุดจุดตัดขาดทุน (${stopLoss.toFixed(2)})`,
        actionTh: `ราคาปัจจุบัน ${item.currentPrice.toFixed(2)} (${pnlPct}%) แนะนำทำตามวินัยตัดขาดทุนหรือลดน้ำหนักทันที`,
      });
    } else if (pnlPct <= -3.5) {
      status = "alert";
      emergencyAlerts.push({
        symbol: item.symbol,
        severity: "warning",
        title: `${item.symbol} แกว่งลงแรงกว่า -3.5% ระหว่างสัปดาห์`,
        actionTh: `จับตาแนวรับ Stop Loss ที่ ${stopLoss.toFixed(2)} อย่างใกล้ชิด ห้ามถัวเฉลี่ยขาลง`,
      });
    }

    return {
      rank: idx + 1,
      symbol: meta.symbol,
      currency: meta.currency,
      companyName: meta.name,
      sector: meta.sector,
      weightPct: Number((100 / Math.max(1, top5.length)).toFixed(1)),
      allocatedBaht,
      sharesBoardLot,
      entryPrice: entry,
      currentPrice: item.currentPrice,
      stopLoss,
      targetPrice,
      rrRatio,
      pnlPct,
      pnlBaht,
      status,
      winRate5dPct: tmFull.hitTargetPct,
      expectancy5dR: tmFull.expectancyR,
      scores: item.evalResult.scores,
      rationaleTh: item.evalResult.rationaleTh,
    };
  });

  const setPreWeek = setBars.filter((b) => b.time < currentMonday);
  const setThisWeek = setBars.filter((b) => b.time >= currentMonday);
  const setAnchor =
    setThisWeek.length > 0
      ? setThisWeek[0].open || setThisWeek[0].close
      : setPreWeek[setPreWeek.length - 1]?.close ?? 1;
  const setLatest = setBars[setBars.length - 1]?.close ?? setAnchor;
  const setWeekReturnPct =
    setAnchor > 0 ? Number((((setLatest - setAnchor) / setAnchor) * 100).toFixed(2)) : 0;

  if (setWeekReturnPct <= -2.5) {
    emergencyAlerts.unshift({
      symbol: mCfg.benchmarkLabel,
      severity: "critical",
      title: `ดัชนี ${mCfg.benchmarkLabel} ปรับลงแรง ${setWeekReturnPct.toFixed(2)}% ในสัปดาห์นี้`,
      actionTh: "ภาวะตลาด Risk-Off ควรลดขนาดพอร์ตถือเงินสดเพิ่ม 30–50% และเลื่อน Stop Loss มาคุมความเสี่ยง",
    });
  }

  // Equal-weight average return across Top 5 (clean even when CHINA mixes HKD/USD/CNY)
  const totalPnlPct =
    picks.length > 0
      ? Number((picks.reduce((acc, p) => acc + p.pnlPct, 0) / picks.length).toFixed(2))
      : 0;
  const totalPnlBaht = Number(((baseCapital * totalPnlPct) / 100).toFixed(0));
  const alphaPct = Number((totalPnlPct - setWeekReturnPct).toFixed(2));

  const backtest12W = compute12WeekBacktest(universe, setBars);

  const set50RankingPreview = scored.slice(0, 15).map((s) => ({
    symbol: s.symbol,
    sector: resolveStockSymbol(s.symbol, market).sector,
    totalScore: s.evalResult.scores.total,
    scores: s.evalResult.scores,
    price: s.currentPrice,
    changePct: s.changePct,
  }));

  return {
    market,
    currency: portfolioCurrency,
    benchmarkLabel: mCfg.benchmarkLabel,
    weekLabel: `สัปดาห์เริ่ม ${currentMonday}`,
    mondayDate: currentMonday,
    asOfDate: latestSetDate,
    baseCapital,
    picks,
    totalPnlPct,
    totalPnlBaht,
    setWeekReturnPct,
    alphaPct,
    emergencyAlerts,
    backtest12W,
    set50RankingPreview,
    generatedAt: new Date().toISOString(),
  };
}

function compute12WeekBacktest(
  universe: StockUniverseBundle[],
  setBars: OhlcvBar[]
): WeeklyBacktestPoint[] {
  if (setBars.length < 70 || universe.length < 5) return [];

  const weekBuckets = new Map<string, OhlcvBar[]>();
  for (const b of setBars) {
    const mon = getIsoWeekMonday(b.time);
    const list = weekBuckets.get(mon) ?? [];
    list.push(b);
    weekBuckets.set(mon, list);
  }

  const sortedMondays = Array.from(weekBuckets.keys()).sort();
  const candidateWeeks = sortedMondays.slice(-13, -1);
  if (candidateWeeks.length === 0) return [];

  const stockBarMaps = universe.map((u) => {
    const byDate = new Map<string, number>();
    u.bars.forEach((b, idx) => byDate.set(b.time, idx));
    return { ...u, byDate };
  });

  const points: WeeklyBacktestPoint[] = [];
  let cumPort = 1;
  let cumSet = 1;

  for (const mon of candidateWeeks) {
    const setWeek = weekBuckets.get(mon);
    if (!setWeek || setWeek.length < 2) continue;
    const startDate = setWeek[0].time;
    const endDate = setWeek[setWeek.length - 1].time;
    const setOpen = setWeek[0].open || setWeek[0].close;
    const setClose = setWeek[setWeek.length - 1].close;
    const setRet = setOpen > 0 ? (setClose - setOpen) / setOpen : 0;

    const candidates: { symbol: string; score: number; weekRet: number }[] = [];
    for (const s of stockBarMaps) {
      const startIdx = s.byDate.get(startDate);
      const endIdx = s.byDate.get(endDate);
      if (startIdx === undefined || endIdx === undefined || startIdx < 35) continue;

      const histCloses = s.bars.slice(Math.max(0, startIdx - 60), startIdx).map((b) => b.close);
      const histVols = s.bars.slice(Math.max(0, startIdx - 25), startIdx).map((b) => b.volume);
      const lastC = histCloses[histCloses.length - 1];
      const ema20 = calcEMA(histCloses, 20).at(-1) ?? lastC;
      const ema50 = calcEMA(histCloses, Math.min(50, histCloses.length - 1)).at(-1) ?? lastC;
      const rsi = calcRSI(histCloses, 14).at(-1) ?? 50;
      const avgVol = histVols.reduce((a, b) => a + b, 0) / Math.max(1, histVols.length);
      const volRatio = avgVol > 0 ? histVols[histVols.length - 1] / avgVol : 1;
      const mom10 =
        histCloses.length > 10
          ? (lastC - histCloses[histCloses.length - 11]) / histCloses[histCloses.length - 11]
          : 0;

      let score = 0;
      if (lastC > ema50) score += 25;
      if (lastC > ema20) score += 15;
      if (ema20 > ema50) score += 15;
      if (rsi >= 48 && rsi <= 68) score += 20;
      score += clamp(volRatio * 8, 0, 15);
      score += clamp(mom10 * 150, -10, 15);
      if (s.iaa?.upsidePct) score += clamp(s.iaa.upsidePct * 0.5, -5, 15);

      const entryOpen = s.bars[startIdx].open || s.bars[startIdx].close;
      const sl = entryOpen * 0.955;
      const tp = entryOpen * 1.085;
      let exitPrice = s.bars[endIdx].close;
      for (let d = startIdx; d <= endIdx; d++) {
        if (s.bars[d].low <= sl) {
          exitPrice = sl;
          break;
        }
        if (s.bars[d].high >= tp) {
          exitPrice = tp;
          break;
        }
      }
      const weekRet = entryOpen > 0 ? (exitPrice - entryOpen) / entryOpen : 0;
      candidates.push({ symbol: s.symbol, score, weekRet });
    }

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates.slice(0, 5);
    if (chosen.length === 0) continue;

    const portRet = chosen.reduce((acc, c) => acc + c.weekRet, 0) / chosen.length;
    cumPort *= 1 + portRet;
    cumSet *= 1 + setRet;

    points.push({
      weekLabel: startDate.slice(5),
      startDate,
      endDate,
      portfolioReturnPct: Number((portRet * 100).toFixed(2)),
      setReturnPct: Number((setRet * 100).toFixed(2)),
      cumulativePortfolioPct: Number(((cumPort - 1) * 100).toFixed(2)),
      cumulativeSetPct: Number(((cumSet - 1) * 100).toFixed(2)),
      topPicks: chosen.map((c) => c.symbol),
    });
  }

  return points;
}

export function runSandboxBacktest(params: {
  holdings: { symbol: string; weightPct: number; bars: OhlcvBar[] }[];
  setBars: OhlcvBar[];
  lookbackDays?: number;
  initialCapital?: number;
}) {
  const { holdings, setBars, lookbackDays = 60, initialCapital = 100_000 } = params;
  const activeHoldings = holdings.filter((h) => h.bars.length > 5 && h.weightPct > 0);
  if (activeHoldings.length === 0 || setBars.length < 5) {
    return null;
  }

  const totalWeight = activeHoldings.reduce((acc, h) => acc + h.weightPct, 0);
  const slicedSet = setBars.slice(-Math.min(lookbackDays, setBars.length));
  const dates = slicedSet.map((b) => b.time);

  const maps = activeHoldings.map((h) => {
    const m = new Map<string, number>();
    h.bars.forEach((b) => m.set(b.time, b.close));
    return { symbol: h.symbol, weight: h.weightPct / totalWeight, map: m };
  });

  const setBase = slicedSet[0].close;
  const stockBases = maps.map((item) => {
    for (const d of dates) {
      const v = item.map.get(d);
      if (v && v > 0) return v;
    }
    return 1;
  });

  const lastKnown = [...stockBases];
  const curve: { date: string; portfolioPct: number; setPct: number; portfolioValue: number }[] = [];
  let peakValue = initialCapital;
  let maxDrawdownPct = 0;

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    let weightedGrowth = 0;
    for (let j = 0; j < maps.length; j++) {
      const p = maps[j].map.get(d);
      if (p && p > 0) lastKnown[j] = p;
      weightedGrowth += maps[j].weight * (lastKnown[j] / stockBases[j]);
    }
    const portValue = initialCapital * weightedGrowth;
    if (portValue > peakValue) peakValue = portValue;
    const dd = peakValue > 0 ? ((portValue - peakValue) / peakValue) * 100 : 0;
    if (dd < maxDrawdownPct) maxDrawdownPct = dd;

    const setPct = setBase > 0 ? ((slicedSet[i].close - setBase) / setBase) * 100 : 0;
    curve.push({
      date: d,
      portfolioPct: Number(((weightedGrowth - 1) * 100).toFixed(2)),
      setPct: Number(setPct.toFixed(2)),
      portfolioValue: Number(portValue.toFixed(0)),
    });
  }

  const last = curve[curve.length - 1];
  return {
    initialCapital,
    finalValue: last?.portfolioValue ?? initialCapital,
    totalReturnPct: last?.portfolioPct ?? 0,
    setReturnPct: last?.setPct ?? 0,
    alphaPct: Number(((last?.portfolioPct ?? 0) - (last?.setPct ?? 0)).toFixed(2)),
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    curve,
  };
}
