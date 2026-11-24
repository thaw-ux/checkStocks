# SET 360° AI — ผู้ช่วยวิเคราะห์หุ้นอัจฉริยะ 360° (ไทย · S&P 500 · Nasdaq 100 · จีน)

เว็บแอปวิเคราะห์หุ้นครบ 4 ตลาด (**🇹🇭 SET/SET50 · 🇺🇸 S&P 500 · 🇺🇸 Nasdaq 100 · 🇨🇳 จีน HKEX/ADR/A-Share**) พัฒนาด้วย **Next.js (App Router) + TypeScript ล้วน (Zero-DB)** พร้อมขึ้นใช้งานบน **Vercel** ทันที

## ฟีเจอร์หลักครบทั้ง 5 เมนู
1. **วิเคราะห์ข่าว (Market & News Intelligence)**: 12 การ์ดดัชนีตลาดโลก (SET, S&P 500, Nasdaq 100, Dow Jones, Hang Seng, CSI 300 จีน, Nikkei 225, ทอง, น้ำมัน, ค่าเงินบาท, US 10Y) + ทางลัดหุ้นเด่น 4 ตลาด + AI Auto Briefing 6 มิติ + ข่าวสด 7 หมวด + วิเคราะห์ผลกระทบจากลิงก์/ข้อความข่าว
2. **วิเคราะห์หุ้นรายตัว (Single-Stock Deep Dive — 4 ตลาด)**: ค้นหาได้ทั้งหุ้นไทย (`PTT`, `CPALL`), สหรัฐฯ (`NVDA`, `AAPL`, `TSLA`, `LLY`), และจีน (`0700.HK`, `9988.HK`, `1211.HK`, `BABA`, `PDD`, `600519.SS`) + เป้า Consensus 12 เดือน + Data Audit Strip + อัปโหลด PDF บทวิเคราะห์เองให้ Gemini Pro อ่านเสริม + 5 แท็บย่อย:
   - **กราฟเทคนิค**: TradingView Lightweight Charts (แท่งเทียน + EMA20/50/200 + Volume + เส้นแผน Entry/Stop/Target + RSI/MACD)
   - **แผนเทรด & Time Machine 10,000 รอบ**: คำนวณขนาดไม้ (Board Lot ทีละ 100 หุ้นสำหรับไทย/HK/จีน และทีละ 1 หุ้นสำหรับสหรัฐฯ) + จำลองราคา 10,000 รอบ OHLC (5D / 10D / 20D / Intraday 5m) + ย้อนเช็กกราฟจริงในอดีต
   - **เทียบคู่แข่ง**: เปรียบเทียบ P/E, P/BV, ROE, Yield, Mkt Cap ข้ามตลาดได้ พร้อมค่าเฉลี่ยกลุ่ม
   - **แหล่งข้อมูล & Fact Sheet**: บทวิเคราะห์รายโบรกเกอร์/Wall Street, ข่าวบริษัท 30 วัน, เช็กลิสต์ 5 เกณฑ์ และ Fact Sheet ดิบ
   - **ทดสอบย้อนเวลา (Point-in-Time Replay)**: ตัดข้อมูลอนาคตออก 100% พร้อมระบบตรวจจับ Zero Future Leakage
3. **คัดหุ้น (4 โหมด × 4 ตลาด)**: สลับตลาด `🇹🇭 ไทย SET` / `🇺🇸 S&P 500` / `🇺🇸 Nasdaq 100` / `🇨🇳 จีน` ได้ทันที — Analyst Consensus ทั้งตลาด, บทวิเคราะห์ออกใหม่รายวัน (โบรกไทย / Wall Street / สถาบันจีน), สแกนกราฟ Breakout/Pullback/Oversold, และสแกนข่าวหุ้นเด่นรายวัน
4. **AI Chat Bot 360° (Gemini Pro Streaming)**: พิมพ์ชื่อหุ้นไทย/สหรัฐฯ/จีนปุ๊บ ฟันธงบรรทัดแรกพร้อมการ์ดแผนเทรดกดส่งเข้า Time Machine / บันทึก Paper Trade ได้ทันที และช่วยตรวจพอร์ต Paper Trade ส่วนตัวได้
5. **พอร์ตจำลองรายสัปดาห์ 360° & Paper Trade**: คัดอัตโนมัติ Top 5 ทุกวันจันทร์ด้วยคะแนน 5 มิติ (เลือกได้ทั้ง SET50 / S&P 500 / Nasdaq 100 / หุ้นจีน) + เตือนปรับแผนฉุกเฉิน + Backtest ย้อนหลัง 12 สัปดาห์เทียบดัชนีหลัก + Sandbox Backtest ผสมหุ้นข้ามตลาด + สมุดจด Paper Trade ส่วนตัว (LocalStorage + Export/Import JSON)

## การตั้งค่าและรันในเครื่อง (Local Dev)

1. คัดลอกไฟล์ `.env.example` เป็น `.env.local` (สร้างให้แล้ว) และเติม **`GEMINI_API_KEY`** จาก [Google AI Studio](https://aistudio.google.com/apikey):
```env
APP_PASSCODE=084116
AUTH_SECRET=set360-change-to-a-long-random-secret
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL_PRO=gemini-2.5-pro
GEMINI_MODEL_FAST=gemini-2.5-flash
```
2. ติดตั้งและรัน:
```bash
npm install
npm run dev
```
3. เปิด `http://localhost:3000` และกรอกรหัสผ่าน `084116` เพื่อเข้าใช้งาน

## การ Deploy ขึ้น Vercel
1. Push โปรเจกต์ขึ้น GitHub แล้ว Import เข้า [Vercel](https://vercel.com)
2. ตั้งค่า Environment Variables บน Vercel:
   - `APP_PASSCODE` = `084116` (หรือรหัสผ่านที่คุณต้องการ)
   - `AUTH_SECRET` = generate-secret.vercel.app/32
   - `GEMINI_API_KEY` = API Key ของ Gemini Pro
   - `GEMINI_MODEL_PRO` = `gemini-2.5-pro`
   - `GEMINI_MODEL_FAST` = `gemini-2.5-flash`
3. กด **Deploy** ได้เลย (ไม่ต้องตั้งค่า Database ภายนอกใดๆ)
