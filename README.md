# SET 360° AI — ผู้ช่วยวิเคราะห์หุ้นไทยอัจฉริยะ 360°

เว็บแอปวิเคราะห์หุ้นไทยครบวงจร พัฒนาด้วย **Next.js (App Router) + TypeScript ล้วน (Zero-DB)** พร้อมขึ้นใช้งานบน **Vercel** ทันที

## ฟีเจอร์หลักครบทั้ง 5 เมนู
1. **วิเคราะห์ข่าว (Market & News Intelligence)**: 12 การ์ดดัชนีตลาดโลก ทองคำ น้ำมัน ค่าเงินบาท บอนด์ยีลด์ + AI Auto Briefing 6 มิติ + ตารางหุ้นไทยที่ได้รับผลกระทบ + ข่าวสด 7 หมวด + วิเคราะห์ผลกระทบจากลิงก์/ข้อความข่าว
2. **วิเคราะห์หุ้นรายตัว (Single-Stock Deep Dive)**: ค้นหาได้ทุกหุ้น SET/mai + เป้า IAA/Consensus 12 เดือน + Data Audit Strip + อัปโหลด PDF บทวิเคราะห์เองให้ Gemini Pro อ่านเสริม + 5 แท็บย่อย:
   - **กราฟเทคนิค**: TradingView Lightweight Charts (แท่งเทียน + EMA20/50/200 + Volume + เส้นแผน Entry/Stop/Target + RSI/MACD)
   - **แผนเทรด & Time Machine 10,000 รอบ**: คำนวณขนาดไม้ Board Lot (ทีละ 100 หุ้น) + จำลองราคา 10,000 รอบจากพฤติกรรมแท่งเทียนจริง OHLC (5D / 10D / 20D / Intraday 5m) + ย้อนเช็กกราฟจริงในอดีต
   - **เทียบคู่แข่ง**: ตารางเปรียบเทียบ P/E, P/BV, ROE, Yield, Mkt Cap พร้อมค่าเฉลี่ยกลุ่ม
   - **แหล่งข้อมูล & Fact Sheet**: บทวิเคราะห์รายโบรกเกอร์, ข่าวบริษัท 30 วัน, เช็กลิสต์ 5 เกณฑ์ และ Fact Sheet ดิบที่ส่งให้ AI
   - **ทดสอบย้อนเวลา (Point-in-Time Replay)**: ตัดข้อมูลอนาคตออก 100% พร้อมระบบตรวจจับ Zero Future Leakage
3. **คัดหุ้น (4 โหมด)**: IAA Consensus ทั้งตลาด (~230+ หุ้น), บทวิเคราะห์ออกใหม่รายวัน (20+ โบรกเกอร์), สแกนกราฟเทคนิค **SET50** (Breakout + Volume / Pullback > EMA200 / Oversold), และสแกนข่าวโพยโบรกฯ รายวัน
4. **AI Chat Bot 360° (Gemini Pro Streaming)**: พิมพ์ชื่อหุ้นปุ๊บ ฟันธงบรรทัดแรกพร้อมการ์ดแผนเทรดที่กดส่งเข้า Time Machine / บันทึก Paper Trade ได้ทันที และช่วยตรวจพอร์ต Paper Trade ส่วนตัวได้
5. **พอร์ตจำลองรายสัปดาห์ 360° & Paper Trade**: คัดอัตโนมัติ Top 5 SET50 ทุกวันจันทร์ด้วยคะแนน 5 มิติ + เตือนปรับแผนฉุกเฉิน + Backtest ย้อนหลัง 12 สัปดาห์เทียบ SET + Sandbox Backtest + สมุดจด Paper Trade ส่วนตัว (LocalStorage + Export/Import JSON)

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
   - `AUTH_SECRET` = 33f87a948f6fdb006879fcfc3a51cee1
   - `GEMINI_API_KEY` = API Key ของ Gemini Pro
   - `GEMINI_MODEL_PRO` = `gemini-2.5-pro`
   - `GEMINI_MODEL_FAST` = `gemini-2.5-flash`
3. กด **Deploy** ได้เลย (ไม่ต้องตั้งค่า Database ภายนอกใดๆ)
