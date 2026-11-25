export type MarketId = "SP500" | "NASDAQ100" | "HK" | "CHINA" | "DR";
export type CurrencyCode = "USD" | "HKD" | "CNY" | "THB";

export interface FxRatesToThb {
  USD: number;
  HKD: number;
  CNY: number;
  THB: number;
  updatedAt: string;
}

export interface SupportResistanceLevel {
  label: string; // S1, S2, S3, R1, R2, R3
  kind: "support" | "resistance";
  price: number;
  zoneLow: number;
  zoneHigh: number;
  distancePct: number; // positive % distance from current price
  touches: number;
  strength: number; // 1..5 stars
  roleFlip: boolean;
  sources: string[]; // e.g. ["Swing Pivot", "Volume POC", "Fib 61.8%", "EMA 200"]
}

export interface FibLevel {
  ratio: number;
  label: string;
  price: number;
}

export interface SupportResistanceMap {
  timeframe: "day" | "week";
  price: number;
  pocPrice: number;
  supports: SupportResistanceLevel[];
  resistances: SupportResistanceLevel[];
  fibLevels: FibLevel[];
  fibSwingHigh: number;
  fibSwingLow: number;
  nearestSupportDistPct: number | null;
  nearestResistanceDistPct: number | null;
  zonePositionPct: number; // 0..100 between S1 and R1
  zoneLabelTh: string;
}

export interface IndexSrRadarItem {
  symbol: string;
  displaySymbol: string;
  labelTh: string;
  flag: string;
  market: MarketId;
  price: number;
  changePct: number;
  trendLabel: string;
  trendBias: "bullish" | "neutral" | "bearish";
  rsi14: number | null;
  srDaily: SupportResistanceMap;
  srWeekly: SupportResistanceMap;
}

export interface OhlcvBar {
  time: string; // YYYY-MM-DD for daily, ISO or unix string for intraday
  timestamp: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DataAuditItem {
  id: string;
  label: string;
  status: "live" | "partial" | "unavailable";
  detail: string;
  url?: string;
  timestamp: string;
}

export interface GlobalMacroItem {
  symbol: string;
  labelTh: string;
  category: "us" | "hk_cn" | "volatility" | "commodity" | "fx_bond";
  price: number;
  change: number;
  changePct: number;
  unit?: string;
  updatedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  category: string;
  snippet?: string;
  tickers?: string[];
}

export interface AffectedStockItem {
  symbol: string;
  market?: MarketId;
  currency?: CurrencyCode;
  sector: string;
  sentiment: "positive" | "neutral" | "negative";
  reason: string;
  price?: number;
  changePct?: number;
}

export interface DailyBriefingSection {
  key: string;
  title: string;
  content: string;
}

export interface MarketOverviewPayload {
  macroCards: GlobalMacroItem[];
  fxRates?: FxRatesToThb;
  indexSrRadar?: IndexSrRadarItem[];
  briefing: {
    headline: string;
    mood: "Risk-On" | "Neutral" | "Risk-Off";
    sections: DailyBriefingSection[];
    modelUsed: string;
    isAiGenerated: boolean;
  };
  affectedStocks: AffectedStockItem[];
  categorizedNews: Record<string, NewsItem[]>;
  totalHeadlines: number;
  dataAudit: DataAuditItem[];
  generatedAt: string;
}

export interface NewsImpactResult {
  headline: string;
  overallImpact: "เชิงบวก (Bullish)" | "เป็นกลาง (Neutral)" | "เชิงลบ (Bearish)" | "ผสมผสาน (Mixed)";
  summary: string;
  affectedSectors: { sector: string; impact: "positive" | "neutral" | "negative"; reason: string }[];
  affectedStocks: AffectedStockItem[];
  actionableTakeaway: string;
  modelUsed: string;
  isAiGenerated: boolean;
}

export interface BrokerReportItem {
  id: string;
  symbol: string;
  market?: MarketId;
  currency?: CurrencyCode;
  broker: string;
  rating: string;
  ratingNormalized: "Buy" | "Hold" | "Sell";
  targetPrice: number | null;
  currentPrice: number | null;
  upsidePct: number | null;
  reportDate: string;
  headline: string;
  url: string;
  pdfUrl?: string;
  source: string;
}

export interface IaaConsensusSummary {
  symbol: string;
  market?: MarketId;
  currency?: CurrencyCode;
  companyName: string;
  sector: string;
  currentPrice: number;
  avgTargetPrice: number | null;
  medianTargetPrice: number | null;
  highTargetPrice: number | null;
  lowTargetPrice: number | null;
  upsidePct: number | null;
  buyCount: number;
  holdCount: number;
  sellCount: number;
  totalBrokers: number;
  buyRatioPct: number | null;
  recommendationKey: string;
  source: string;
  settradeUrl: string;
  updatedAt: string;
}

export interface StockFundamentals {
  pe: number | null;
  forwardPe: number | null;
  pbv: number | null;
  roe: number | null; // percentage e.g. 14.5
  dividendYield: number | null; // percentage e.g. 4.2
  exDividendDate: string | null;
  marketCapBillion: number | null;
  volumeRatio20d: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  cashBalanceStatus: string;
}

export interface StockTechnicalSummary {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  atr14: number | null;
  volMa20: number | null;
  volRatio: number | null;
  s1: number;
  s2: number;
  r1: number;
  r2: number;
  standardStop: number;
  shortTarget: number;
  trendLabel: string;
  trendBias: "bullish" | "neutral" | "bearish";
  candleTimestamp: string;
}

export interface CitedPoint {
  text: string;
  sourceLabel: string;
  sourceUrl?: string;
}

export interface StockAiSynthesis {
  verdict: string;
  verdictBias: "positive" | "neutral" | "negative";
  oneLineConclusion: string;
  bullCase: CitedPoint[];
  bearCase: CitedPoint[];
  fundamentalView12M: string;
  shortTermPlan: {
    entry: number;
    stop: number;
    target: number;
    rrRatio: number;
    note: string;
  };
  riskConditions: string;
  checklist5: {
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }[];
  modelUsed: string;
  isAiGenerated: boolean;
}

export interface PdfQuoteExtract {
  broker: string;
  title: string;
  url: string;
  excerpt: string;
  extractedAt: string;
  status: "extracted" | "timeout" | "unavailable";
}

export interface StockAnalysisPayload {
  symbol: string;
  yahooSymbol: string;
  market: MarketId;
  currency: CurrencyCode;
  lotSize: number;
  companyName: string;
  sector: string;
  industry: string;
  description: string;
  fundamentals: StockFundamentals;
  technicals: StockTechnicalSummary;
  iaaConsensus: IaaConsensusSummary;
  brokerReports: BrokerReportItem[];
  companyNews: NewsItem[];
  brokerWebResearch: NewsItem[];
  pdfQuotes: PdfQuoteExtract[];
  aiSynthesis: StockAiSynthesis;
  factSheetMarkdown: string;
  dataAudit: DataAuditItem[];
  srDaily: SupportResistanceMap;
  srWeekly: SupportResistanceMap;
  bars: OhlcvBar[];
  intradayBars?: OhlcvBar[];
  defaultPeers: string[];
  generatedAt: string;
}

export type TimeMachineHorizon = "5d" | "10d" | "20d" | "1d_5m";

export interface TimeMachineResult {
  symbol: string;
  horizon: TimeMachineHorizon;
  horizonLabel: string;
  steps: number;
  simulations: number;
  entry: number;
  stop: number;
  target: number;
  rrRatio: number;
  hitTargetPct: number;
  hitStopPct: number;
  unresolvedPct: number;
  expectancyR: number;
  verdictLabel: string;
  verdictBias: "positive" | "neutral" | "negative";
  percentileBands: {
    step: number;
    label: string;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }[];
  samplePaths: {
    outcome: "target" | "stop" | "open";
    prices: number[];
  }[];
  historicalBackcheck: {
    totalCases: number;
    hitTarget: number;
    hitStop: number;
    unresolved: number;
    winRatePct: number;
  };
  elapsedMs: number;
}

export interface TechnicalSetupItem {
  symbol: string;
  market?: MarketId;
  currency?: CurrencyCode;
  companyName: string;
  sector: string;
  price: number;
  changePct1d: number;
  setupType:
    | "Breakout + Volume"
    | "Pullback > EMA200"
    | "Oversold Rebound"
    | "Near Support (S1)"
    | "Near Resistance (R1)";
  entry: number;
  stop: number;
  target: number;
  rrRatio: number;
  rsi14: number;
  volRatio: number;
  ema200DistPct: number | null;
  s1: number;
  s1DistPct: number;
  s1Strength: number;
  r1: number;
  r1DistPct: number;
  r1Strength: number;
  pocPrice: number;
  zonePositionPct: number;
  reasonTh: string;
}

export interface NewsPickItem {
  rank: number;
  symbol: string;
  market?: MarketId;
  companyName: string;
  sector: string;
  mentionCount: number;
  sources: string[];
  headlines: { title: string; link: string; source: string; pubDate: string }[];
  sentiment: "positive" | "neutral" | "negative";
}

export interface PeerMetricRow {
  symbol: string;
  currency?: CurrencyCode;
  companyName: string;
  price: number | null;
  changePct: number | null;
  pe: number | null;
  pbv: number | null;
  roe: number | null;
  dividendYield: number | null;
  marketCapBillion: number | null;
}

export interface PointInTimeReplayResult {
  symbol: string;
  asOfDate: string;
  priceAtAsOf: number;
  actualPriceLater: number | null;
  actualReturnPct: number | null;
  daysElapsed: number;
  cutoffNewsCount: number;
  excludedFutureNewsCount: number;
  aiSummary: string;
  leakageAudit: {
    passed: boolean;
    flaggedTerms: string[];
    explanation: string;
  };
  verdictAccuracy: string;
  modelUsed: string;
  isAiGenerated: boolean;
}

export interface DimensionScore {
  fundamentalIaa: number; // 0-20
  technicalTrend: number; // 0-20
  momentumVolume: number; // 0-20
  timeMachineEdge: number; // 0-20
  riskStability: number; // 0-20
  total: number; // 0-100
}

export interface WeeklyPortfolioPick {
  rank: number;
  symbol: string;
  currency?: CurrencyCode;
  companyName: string;
  sector: string;
  weightPct: number;
  allocatedBaht: number;
  sharesBoardLot: number;
  entryPrice: number; // Monday open/anchor
  currentPrice: number;
  stopLoss: number;
  targetPrice: number;
  rrRatio: number;
  pnlPct: number;
  pnlBaht: number;
  status: "active" | "hit_target" | "hit_stop" | "alert";
  winRate5dPct: number;
  expectancy5dR: number;
  scores: DimensionScore;
  rationaleTh: string;
}

export interface EmergencyAlertItem {
  symbol: string;
  severity: "critical" | "warning";
  title: string;
  actionTh: string;
}

export interface WeeklyBacktestPoint {
  weekLabel: string;
  startDate: string;
  endDate: string;
  portfolioReturnPct: number;
  setReturnPct: number;
  cumulativePortfolioPct: number;
  cumulativeSetPct: number;
  topPicks: string[];
}

export interface WeeklyPortfolioPayload {
  market: MarketId;
  currency: CurrencyCode;
  benchmarkLabel: string;
  weekLabel: string;
  mondayDate: string;
  asOfDate: string;
  baseCapital: number;
  picks: WeeklyPortfolioPick[];
  totalPnlPct: number;
  totalPnlBaht: number;
  setWeekReturnPct: number;
  alphaPct: number;
  emergencyAlerts: EmergencyAlertItem[];
  backtest12W: WeeklyBacktestPoint[];
  set50RankingPreview: {
    symbol: string;
    sector: string;
    totalScore: number;
    scores: DimensionScore;
    price: number;
    changePct: number;
  }[];
  generatedAt: string;
}

export interface TradePlanCardData {
  symbol: string;
  market?: MarketId;
  currency?: CurrencyCode;
  action: string;
  entry: number;
  stop: number;
  target: number;
  rrRatio: number;
  iaaTarget?: number | null;
  timeMachineWinPct?: number | null;
  note?: string;
}

export interface PaperTradeEntry {
  id: string;
  symbol: string;
  market?: MarketId;
  currency?: CurrencyCode;
  status: "open" | "closed";
  entryPrice: number;
  exitPrice?: number;
  shares: number;
  stopLoss: number;
  targetPrice: number;
  entryDate: string;
  exitDate?: string;
  strategy: string;
  note: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tradePlan?: TradePlanCardData | null;
  detectedTickers?: string[];
  modelUsed?: string;
  createdAt: string;
}
