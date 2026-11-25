"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Briefcase,
  CheckCircle2,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Newspaper,
  RefreshCw,
  Search,
  Settings,
  Smartphone,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { CollapsibleDisclaimer } from "@/components/common/UiPrimitives";
import { ChatTab } from "@/components/tabs/ChatTab";
import { NewsTab } from "@/components/tabs/NewsTab";
import { PortfolioTab } from "@/components/tabs/PortfolioTab";
import { ScannerTab } from "@/components/tabs/ScannerTab";
import { StockTab } from "@/components/tabs/StockTab";
import { useAppStore, type MainTabId } from "@/store/useAppStore";

interface SystemStatus {
  geminiConfigured: boolean;
  defaultProModel: string;
  defaultFlashModel: string;
  availableModels: { id: string; label: string }[];
}

export function AppShell() {
  const router = useRouter();
  const {
    activeTab,
    setActiveTab,
    paperTrades,
    theme,
    toggleTheme,
    displayMode,
    setDisplayMode,
    modelSettings,
    setModelSettings,
    toastMessage,
    showToast,
  } = useAppStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    fetch("/api/system/status")
      .then((r) => r.json())
      .then((j: SystemStatus) => setSysStatus(j))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function handleClearServerCache() {
    setClearingCache(true);
    try {
      await fetch("/api/system/status", { method: "POST", body: "{}" });
      showToast("ล้างแคชข้อมูลฝั่งเซิร์ฟเวอร์เรียบร้อยแล้ว");
    } finally {
      setClearingCache(false);
    }
  }

  const openTradesCount = paperTrades.filter((t) => t.status === "open").length;

  const navTabs: {
    id: MainTabId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: "news",
      label: "วิเคราะห์ข่าว",
      shortLabel: "ข่าวตลาด",
      icon: <Newspaper className="h-4 w-4" />,
    },
    {
      id: "stock",
      label: "วิเคราะห์หุ้น",
      shortLabel: "วิเคราะห์หุ้น",
      icon: <Search className="h-4 w-4" />,
    },
    {
      id: "scanner",
      label: "คัดหุ้น",
      shortLabel: "คัดหุ้น",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      id: "chat",
      label: "AI Chat Bot",
      shortLabel: "AI Chat",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "portfolio",
      label: "พอร์ตจำลอง 360°",
      shortLabel: "พอร์ต 360°",
      icon: <Briefcase className="h-4 w-4" />,
      badge: openTradesCount > 0 ? openTradesCount : undefined,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-[#091121]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-5">
          {/* Row 1: Brand + Controls */}
          <div className="h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                <TrendingUp className="h-5 w-5 text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                    GLOBAL <span className="text-sky-500">360° AI</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    Quant + Gemini Pro
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  🇺🇸 S&P 500 · Nasdaq 100 · 🇭🇰 ฮ่องกง HKEX · 🇨🇳 จีน A-Share/ADR · 🇹🇭 DR หุ้นนอก · Smart Confluence S/R
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* View mode quick switcher */}
              <div className="hidden md:flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDisplayMode("desktop")}
                  className={`px-2 py-1 rounded-lg inline-flex items-center gap-1 transition cursor-pointer ${
                    displayMode === "desktop"
                      ? "bg-white dark:bg-slate-800 text-sky-500 font-bold shadow-xs"
                      : "text-slate-500"
                  }`}
                  title="บังคับโหมดตารางเต็มจอ (Desktop Table)"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  ตาราง
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode("mobile")}
                  className={`px-2 py-1 rounded-lg inline-flex items-center gap-1 transition cursor-pointer ${
                    displayMode === "mobile"
                      ? "bg-white dark:bg-slate-800 text-sky-500 font-bold shadow-xs"
                      : "text-slate-500"
                  }`}
                  title="บังคับโหมดการ์ด (Mobile Card View)"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  การ์ด
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-sky-400 transition cursor-pointer"
                title={theme === "dark" ? "สลับเป็น Light Mode" : "สลับเป็น Dark Mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Settings Button */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-sky-400 transition cursor-pointer relative"
                title="ตั้งค่าระบบ & โมเดล Gemini"
              >
                <Settings className="h-4 w-4" />
                {sysStatus && (
                  <span
                    className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                      sysStatus.geminiConfigured ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                )}
              </button>

              {/* Lock / Logout */}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="h-9 px-2.5 sm:px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                title="ล็อกหน้าจอ / ออกจากระบบ"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ล็อกออก</span>
              </button>
            </div>
          </div>

          {/* Row 2: 5 Main Navigation Tabs */}
          <nav className="flex items-center gap-1.5 pb-2.5 overflow-x-auto no-scrollbar">
            {navTabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-slate-950 shadow-md shadow-sky-500/20"
                      : "bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-transparent dark:border-slate-800"
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.shortLabel}</span>
                  {t.badge !== undefined && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        active
                          ? "bg-slate-950/20 text-slate-950"
                          : "bg-sky-500/20 text-sky-500"
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-5">
        {activeTab === "news" && <NewsTab />}
        {activeTab === "stock" && <StockTab />}
        {activeTab === "scanner" && <ScannerTab />}
        {activeTab === "chat" && <ChatTab />}
        {activeTab === "portfolio" && <PortfolioTab />}
        <CollapsibleDisclaimer />
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 border border-emerald-500/40 text-slate-100 px-4 py-3 shadow-2xl text-xs font-semibold flex items-center gap-2 max-w-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Settings Drawer / Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="h-4 w-4 text-sky-500" />
                ตั้งค่าระบบ GLOBAL 360° AI
              </h3>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Gemini Status */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>สถานะ Google Gemini API</span>
                <span
                  className={
                    sysStatus?.geminiConfigured
                      ? "text-emerald-500 font-bold"
                      : "text-amber-500 font-bold"
                  }
                >
                  {sysStatus?.geminiConfigured ? "เชื่อมต่อแล้ว (Live)" : "ยังไม่ได้ใส่ GEMINI_API_KEY"}
                </span>
              </div>
              {!sysStatus?.geminiConfigured && (
                <p className="text-[11px] text-slate-500">
                  เพิ่มค่า <code>GEMINI_API_KEY</code> ในไฟล์ <code>.env.local</code> หรือ Vercel
                  Environment Variables เพื่อเปิดใช้ Gemini Pro เต็มรูปแบบ (ปัจจุบันใช้โหมดข้อมูลสด +
                  Rule-Based Fallback)
                </p>
              )}
            </div>

            {/* Model selection */}
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  โมเดลหลัก (วิเคราะห์หุ้นเชิงลึก, PDF, Chat Bot):
                </label>
                <select
                  value={modelSettings.proModel}
                  onChange={(e) =>
                    setModelSettings({ ...modelSettings, proModel: e.target.value })
                  }
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none"
                >
                  {(
                    sysStatus?.availableModels ?? [
                      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
                      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
                    ]
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  โมเดลความเร็วสูง (สรุปข่าวเช้า 6 มิติ, วิเคราะห์ลิงก์ข่าว):
                </label>
                <select
                  value={modelSettings.flashModel}
                  onChange={(e) =>
                    setModelSettings({ ...modelSettings, flashModel: e.target.value })
                  }
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none"
                >
                  {(
                    sysStatus?.availableModels ?? [
                      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
                      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
                    ]
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Display mode */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                โหมดการแสดงผลตาราง / การ์ด:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["auto", "อัตโนมัติ"],
                    ["desktop", "ตารางเต็มจอ"],
                    ["mobile", "การ์ดมือถือ"],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDisplayMode(val)}
                    className={`py-2 rounded-xl font-semibold border transition cursor-pointer ${
                      displayMode === val
                        ? "bg-sky-500 text-slate-950 border-sky-500"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Cache Clear */}
            <button
              type="button"
              onClick={() => void handleClearServerCache()}
              disabled={clearingCache}
              className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-sky-400 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${clearingCache ? "animate-spin" : ""}`} />
              ล้างแคชข้อมูลตลาดฝั่งเซิร์ฟเวอร์
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
