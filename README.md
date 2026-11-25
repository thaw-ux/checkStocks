# GLOBAL 360° AI — ผู้ช่วยวิเคราะห์หุ้นต่างประเทศอัจฉริยะ 360°

เว็บแอปวิเคราะห์หุ้นต่างประเทศครบวงจร สร้างด้วย **Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Google Gemini (`gemini-2.5-pro` / `gemini-2.5-flash`) + TradingView Lightweight Charts v5** ออกแบบมาสำหรับการใช้งานส่วนตัวผ่าน Vercel (Zero-DB) พร้อม Passcode Gate ฝั่งเซิร์ฟเวอร์

## 5 ตลาดต่างประเทศที่รองรับครบทุกเมนู
1. **🇺🇸 S&P 500 (`SP500`)** — หุ้นขนาดใหญ่สหรัฐฯ + ดัชนี `^GSPC` / `^DJI` / ETF `SPY`, `VOO` (USD `$`)
2. **🇺🇸 Nasdaq 100 (`NASDAQ100`)** — หุ้นเทคฯ & AI สหรัฐฯ + ดัชนี `^NDX` / ETF `QQQ` (USD `$`)
3. **🇭🇰 ฮ่องกง (`HK`)** — หุ้น HKEX & Hang Seng (`0700.HK`, `9988.HK`, `1211.HK`, `1810.HK`, `3690.HK`, `0005.HK`, `1299.HK`, `^HSI`, `3033.HK`, `2800.HK` ฯลฯ · HKD `HK$`)
4. **🇨🇳 จีน (`CHINA`)** — หุ้นจีนแผ่นดินใหญ่ A-Share (`600519.SS`, `300750.SZ`, `600036.SS`, `000858.SZ`, `002594.SZ`, `000001.SS`, `399001.SZ` · CNY `¥`) + China US ADRs & ETFs (`BABA`, `PDD`, `JD`, `BIDU`, `NIO`, `XPEV`, `LI`, `KWEB`, `FXI`, `ASHR` · USD `$`)
5. **🇹🇭 DR หุ้นต่างประเทศ (`DR`)** — 25 DR อ้างอิงหุ้นสหรัฐฯ/ฮ่องกง/จีน เทรดเป็นเงินบาท (`NVDA80`, `AAPL80`, `MSFT80`, `TSLA80`, `TENCENT80`, `BABA80`, `BYDCOM80`, `NDX01`, `SP50001`, `CN01`, `HK01` · THB `฿`)

## 5 เมนูหลัก
1. **วิเคราะห์ข่าว (Global Morning Briefing & News Impact)**
   - การ์ดดัชนีตลาดโลก 12 ตัวชี้วัด (`S&P 500`, `Nasdaq 100`, `Dow Jones`, `Hang Seng`, `Shanghai`, `Shenzhen`, `VIX`, `Gold`, `Brent`, `US 10Y Yield`, `USD/THB`, `HKD/THB`)
   - **Index S/R Radar 5 ดัชนีโลก** (`^GSPC`, `^NDX`, `^DJI`, `^HSI`, `000001.SS`) คำนวณ Smart Confluence แนวรับ-แนวต้านทั้ง Day และ Week
   - AI สรุป Global Morning Briefing 6 มิติเป็นภาษาไทย 100% + ตารางหุ้นต่างประเทศที่ได้รับผลกระทบ + วิเคราะห์ลิงก์/ข้อความข่าวต่างประเทศ
2. **วิเคราะห์หุ้น (Stock 360° + Smart Confluence S/R + Time Machine 10,000 รอบ)**
   - กราฟแท่งเทียน TradingView v5 พร้อมเส้นแนวรับ S1–S3, แนวต้าน R1–R3, Volume Profile POC, Fibonacci Retracement และสลับ Day / Week
   - Analyst Consensus 12 เดือน + ปุ่มอัปโหลด PDF บทวิเคราะห์ให้ Gemini Pro สรุป
   - เครื่องคำนวณขนาดไม้ตามสกุลเงินจริง (`1 หุ้น` สำหรับ US/DR · `Board Lot 100 หุ้น` สำหรับ HKEX/A-Share) + Time Machine จำลองราคา 10,000 รอบจากแท่งเทียนจริง + Peer Comparison + Point-in-Time Replay
3. **คัดหุ้น (4-Mode Global Scanner)**
   - จัดอันดับ Analyst Consensus ทั้งตลาด · ฟีด Wall Street / โบรกฯ รายวัน · สแกนกราฟ & แนวรับ-แนวต้าน (`Breakout + Vol`, `Pullback > EMA200`, `ชิดแนวรับ S1`, `จ่อเบรกต้าน R1`, `Oversold`) · สแกนข่าวหุ้นเด่นรายวัน
4. **AI Chat Bot 360°**
   - สตรีมคำตอบภาษาไทยด้วย Gemini 2.5 Pro เชื่อมต่อข้อมูลสดทั้ง 5 ตลาด, Smart Confluence S/R, Time Machine 10,000 รอบ, อัตราแลกเปลี่ยน FX สด และ Paper Trade ของผู้ใช้ พร้อมการ์ดแผนเทรดคลิกส่งเข้า Time Machine / Paper Trade ได้ทันที
5. **พอร์ตจำลอง 360° & สมุดจด Paper Trade (แปลงเป็นเงินบาทอัตโนมัติ)**
   - พอร์ตจำลองรายสัปดาห์ 5 มิติ (Zero Look-Ahead) + Backtest 12 สัปดาห์ + Sandbox จัดพอร์ตผสมข้ามตลาด
   - สมุดจด Paper Trade (Zero-DB `localStorage` + Export/Import JSON) พร้อมปุ่ม **แปลงมูลค่ารวมและกำไร-ขาดทุนสุทธิเป็นเงินบาท (THB)** ด้วยเรตสด `USD/THB`, `HKD/THB`, `CNY/THB`

## การตั้งค่า Environment Variables (`.env.local` / Vercel)
```env
APP_PASSCODE=084116
AUTH_SECRET=สตริงสุ่มความยาวอย่างน้อย_32_ตัวอักษร
GEMINI_API_KEY=ใส่คีย์_Google_AI_Studio_หรือ_Vertex_AI_Express_Mode
GEMINI_MODEL_PRO=gemini-2.5-pro
GEMINI_MODEL_FAST=gemini-2.5-flash
```

## การรันบนเครื่อง (Local Development)
```bash
npm install
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000` แล้วใส่รหัสผ่านที่ตั้งไว้ใน `APP_PASSCODE`
