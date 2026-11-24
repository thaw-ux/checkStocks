"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { PaperTradeEntry, TradePlanCardData } from "@/lib/types";

export type MainTabId = "news" | "stock" | "scanner" | "chat" | "portfolio";
export type StockSubTabId = "chart" | "timemachine" | "peers" | "sources" | "replay";
export type DisplayMode = "auto" | "desktop" | "mobile";

export interface PrefilledTradePlan {
  symbol: string;
  entry: number;
  stop: number;
  target: number;
  sourceLabel?: string;
  timestamp: number;
}

export interface ModelSettings {
  proModel: string;
  flashModel: string;
}

interface AppContextValue {
  activeTab: MainTabId;
  setActiveTab: (tab: MainTabId) => void;
  activeSymbol: string;
  setActiveSymbol: (sym: string) => void;
  stockSubTab: StockSubTabId;
  setStockSubTab: (sub: StockSubTabId) => void;
  prefilledPlan: PrefilledTradePlan | null;
  clearPrefilledPlan: () => void;
  jumpToStock: (symbol: string, subTab?: StockSubTabId) => void;
  jumpToTimeMachine: (plan: {
    symbol: string;
    entry: number;
    stop: number;
    target: number;
    sourceLabel?: string;
  }) => void;
  paperTrades: PaperTradeEntry[];
  addPaperTrade: (entry: Omit<PaperTradeEntry, "id" | "createdAt">) => void;
  quickAddPlanToPaperTrade: (plan: TradePlanCardData, portfolioBaht?: number) => void;
  closePaperTrade: (id: string, exitPrice: number) => void;
  deletePaperTrade: (id: string) => void;
  exportPaperTradesJson: () => string;
  importPaperTradesJson: (raw: string) => { ok: boolean; count: number; error?: string };
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  isCardView: boolean;
  modelSettings: ModelSettings;
  setModelSettings: (settings: ModelSettings) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const LS_PAPER = "set360_paper_trades_v1";
const LS_WATCHLIST = "set360_watchlist_v1";
const LS_THEME = "set360_theme_v1";
const LS_VIEW = "set360_view_v1";
const LS_MODELS = "set360_models_v1";

const DEFAULT_WATCHLIST = ["PTT", "CPALL", "BDMS", "AOT", "KBANK", "ADVANC", "GULF", "AAI"];

const AppContext = createContext<AppContextValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<MainTabId>("news");
  const [activeSymbol, setActiveSymbol] = useState<string>("PTT");
  const [stockSubTab, setStockSubTab] = useState<StockSubTabId>("chart");
  const [prefilledPlan, setPrefilledPlan] = useState<PrefilledTradePlan | null>(null);
  const [paperTrades, setPaperTrades] = useState<PaperTradeEntry[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [displayMode, setDisplayModeState] = useState<DisplayMode>("auto");
  const [windowWidth, setWindowWidth] = useState<number>(1280);
  const [modelSettings, setModelSettingsState] = useState<ModelSettings>({
    proModel: "gemini-2.5-pro",
    flashModel: "gemini-2.5-flash",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    try {
      const savedTrades = localStorage.getItem(LS_PAPER);
      if (savedTrades) setPaperTrades(JSON.parse(savedTrades) as PaperTradeEntry[]);
      const savedWatch = localStorage.getItem(LS_WATCHLIST);
      if (savedWatch) {
        const parsed = JSON.parse(savedWatch) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) setWatchlist(parsed);
      }
      const savedTheme = localStorage.getItem(LS_THEME);
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      const savedView = localStorage.getItem(LS_VIEW);
      if (savedView === "auto" || savedView === "desktop" || savedView === "mobile") {
        setDisplayModeState(savedView);
      }
      const savedModels = localStorage.getItem(LS_MODELS);
      if (savedModels) {
        const parsed = JSON.parse(savedModels) as Partial<ModelSettings>;
        setModelSettingsState({
          proModel: parsed.proModel || "gemini-2.5-pro",
          flashModel: parsed.flashModel || "gemini-2.5-flash",
        });
      }
    } catch {
      // Ignore malformed localStorage
    }
    setWindowWidth(window.innerWidth);
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    setHydrated(true);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    if (theme === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
    localStorage.setItem(LS_THEME, theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_PAPER, JSON.stringify(paperTrades));
  }, [paperTrades, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_WATCHLIST, JSON.stringify(watchlist));
  }, [watchlist, hydrated]);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    localStorage.setItem(LS_VIEW, mode);
  }, []);

  const setModelSettings = useCallback((settings: ModelSettings) => {
    setModelSettingsState(settings);
    localStorage.setItem(LS_MODELS, JSON.stringify(settings));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const jumpToStock = useCallback((symbol: string, subTab: StockSubTabId = "chart") => {
    const clean = symbol.trim().toUpperCase().replace(/\.BK$/i, "");
    if (!clean) return;
    setActiveSymbol(clean);
    setStockSubTab(subTab);
    setActiveTab("stock");
  }, []);

  const jumpToTimeMachine = useCallback(
    (plan: {
      symbol: string;
      entry: number;
      stop: number;
      target: number;
      sourceLabel?: string;
    }) => {
      const clean = plan.symbol.trim().toUpperCase().replace(/\.BK$/i, "");
      setActiveSymbol(clean);
      setPrefilledPlan({ ...plan, symbol: clean, timestamp: Date.now() });
      setStockSubTab("timemachine");
      setActiveTab("stock");
      showToast(`ส่งแผนเทรด ${clean} เข้าสู่ Time Machine 10,000 รอบแล้ว`);
    },
    [showToast]
  );

  const clearPrefilledPlan = useCallback(() => setPrefilledPlan(null), []);

  const addPaperTrade = useCallback(
    (entry: Omit<PaperTradeEntry, "id" | "createdAt">) => {
      const newItem: PaperTradeEntry = {
        ...entry,
        id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setPaperTrades((prev) => [newItem, ...prev]);
      showToast(`บันทึก ${entry.symbol} (${entry.shares.toLocaleString()} หุ้น) ลงสมุด Paper Trade แล้ว`);
    },
    [showToast]
  );

  const quickAddPlanToPaperTrade = useCallback(
    (plan: TradePlanCardData, portfolioBaht = 100_000) => {
      const riskPerShare = Math.max(0.01, plan.entry - plan.stop);
      const rawShares = Math.floor((portfolioBaht * 0.02) / riskPerShare);
      const maxByCash = plan.entry > 0 ? Math.floor(portfolioBaht / plan.entry) : 100;
      const shares = Math.max(100, Math.floor(Math.min(rawShares, maxByCash) / 100) * 100);
      addPaperTrade({
        symbol: plan.symbol.toUpperCase(),
        status: "open",
        entryPrice: Number(plan.entry.toFixed(2)),
        shares,
        stopLoss: Number(plan.stop.toFixed(2)),
        targetPrice: Number(plan.target.toFixed(2)),
        entryDate: new Date().toISOString().slice(0, 10),
        strategy: plan.action || "แผนเทรด 360°",
        note: plan.note || `R:R 1:${plan.rrRatio}`,
      });
    },
    [addPaperTrade]
  );

  const closePaperTrade = useCallback(
    (id: string, exitPrice: number) => {
      setPaperTrades((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "closed",
                exitPrice: Number(exitPrice.toFixed(2)),
                exitDate: new Date().toISOString().slice(0, 10),
              }
            : item
        )
      );
      showToast("ปิดสถานะ Paper Trade เรียบร้อยแล้ว");
    },
    [showToast]
  );

  const deletePaperTrade = useCallback(
    (id: string) => {
      setPaperTrades((prev) => prev.filter((item) => item.id !== id));
      showToast("ลบรายการออกจากสมุด Paper Trade แล้ว");
    },
    [showToast]
  );

  const exportPaperTradesJson = useCallback(() => {
    return JSON.stringify(
      {
        app: "SET 360 AI",
        exportedAt: new Date().toISOString(),
        watchlist,
        paperTrades,
      },
      null,
      2
    );
  }, [paperTrades, watchlist]);

  const importPaperTradesJson = useCallback(
    (raw: string): { ok: boolean; count: number; error?: string } => {
      try {
        const parsed = JSON.parse(raw) as {
          paperTrades?: PaperTradeEntry[];
          watchlist?: string[];
        };
        const incoming = Array.isArray(parsed)
          ? (parsed as PaperTradeEntry[])
          : parsed.paperTrades;
        if (!Array.isArray(incoming)) {
          return { ok: false, count: 0, error: "ไม่พบโครงสร้างข้อมูล paperTrades ในไฟล์ JSON" };
        }
        const valid = incoming.filter(
          (x) => x && typeof x.symbol === "string" && typeof x.entryPrice === "number"
        );
        setPaperTrades(valid);
        if (Array.isArray(parsed.watchlist) && parsed.watchlist.length > 0) {
          setWatchlist(parsed.watchlist);
        }
        showToast(`นำเข้า Paper Trade สำเร็จ ${valid.length} รายการ`);
        return { ok: true, count: valid.length };
      } catch {
        return { ok: false, count: 0, error: "ไฟล์ JSON ไม่ถูกต้อง" };
      }
    },
    [showToast]
  );

  const addToWatchlist = useCallback(
    (symbol: string) => {
      const clean = symbol.trim().toUpperCase().replace(/\.BK$/i, "");
      if (!clean) return;
      setWatchlist((prev) => (prev.includes(clean) ? prev : [clean, ...prev].slice(0, 20)));
      showToast(`เพิ่ม ${clean} ในรายการติดตามแล้ว`);
    },
    [showToast]
  );

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
  }, []);

  const isCardView =
    displayMode === "mobile" || (displayMode === "auto" && windowWidth < 768);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeSymbol,
        setActiveSymbol,
        stockSubTab,
        setStockSubTab,
        prefilledPlan,
        clearPrefilledPlan,
        jumpToStock,
        jumpToTimeMachine,
        paperTrades,
        addPaperTrade,
        quickAddPlanToPaperTrade,
        closePaperTrade,
        deletePaperTrade,
        exportPaperTradesJson,
        importPaperTradesJson,
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        theme,
        toggleTheme,
        displayMode,
        setDisplayMode,
        isCardView,
        modelSettings,
        setModelSettings,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
