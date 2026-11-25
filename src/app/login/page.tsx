"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, TrendingUp, AlertCircle, Loader2, Delete } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submitPasscode(codeToSubmit: string) {
    if (!codeToSubmit.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: codeToSubmit }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "รหัสผ่านไม่ถูกต้อง");
        setPasscode("");
        inputRef.current?.focus();
        setLoading(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่");
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitPasscode(passcode);
  }

  function handlePadClick(digit: string) {
    if (loading || passcode.length >= 12) return;
    const next = passcode + digit;
    setPasscode(next);
    setError("");
    if (next.length === 6) {
      void submitPasscode(next);
    }
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient fintech grid glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.22), transparent 40%), radial-gradient(circle at 80% 80%, rgba(16,185,129,0.18), transparent 45%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <TrendingUp className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                GLOBAL <span className="text-sky-400">360° AI</span>
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Terminal
              </span>
            </div>
            <p className="text-xs text-slate-400">วิเคราะห์หุ้นต่างประเทศ 360° · สหรัฐฯ · ฮ่องกง · จีน · DR</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 mb-5 flex items-start gap-3">
          <Lock className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-white">ยืนยันรหัสผ่านส่วนตัวก่อนเข้าใช้งาน</span>
            <br />
            ผ่านหน้านี้ครั้งเดียวต่อเซสชัน ปลดล็อกครบทั้ง 5 เมนู (ข่าวตลาดโลก, วิเคราะห์หุ้นสหรัฐฯ-ฮ่องกง-จีน-DR + Time Machine 10,000 รอบ, สแกนกราฟ & แนวรับ-ต้าน, AI Chat Bot และพอร์ตจำลอง 360°)
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              รหัสผ่านเข้าใช้งาน (Passcode)
            </label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError("");
              }}
              placeholder="กรอกรหัสผ่าน 6 หลัก"
              className="w-full text-center text-2xl tracking-[0.45em] font-semibold rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/25 outline-none py-3 px-4 text-white placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick numeric keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handlePadClick(d)}
                disabled={loading}
                className="h-11 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 active:scale-[0.98] border border-slate-700/60 text-base font-semibold text-slate-100 transition cursor-pointer"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPasscode("");
                setError("");
              }}
              disabled={loading}
              className="h-11 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-400 transition cursor-pointer"
            >
              ล้างค่า
            </button>
            <button
              type="button"
              onClick={() => handlePadClick("0")}
              disabled={loading}
              className="h-11 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 active:scale-[0.98] border border-slate-700/60 text-base font-semibold text-slate-100 transition cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPasscode((p) => p.slice(0, -1))}
              disabled={loading}
              className="h-11 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 transition cursor-pointer"
              aria-label="ลบตัวอักษรล่าสุด"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !passcode.trim()}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังตรวจสอบรหัสผ่าน...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                เข้าสู่ระบบ GLOBAL 360° AI
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-[11px] text-center text-slate-500">
          ระบบตรวจสอบสิทธิ์ฝั่ง Server ด้วย Signed Session Cookie · ปิดเบราว์เซอร์แล้วต้องยืนยันใหม่ทุกครั้ง
        </p>
      </div>
    </div>
  );
}
