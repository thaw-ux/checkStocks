import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Inter } from "next/font/google";
import "./globals.css";

const ibmThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-thai",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GLOBAL 360° AI | ผู้ช่วยวิเคราะห์หุ้นต่างประเทศอัจฉริยะ 360°",
  description:
    "วิเคราะห์หุ้นอเมริกา (S&P 500, Nasdaq 100), ฮ่องกง (HKEX), จีน (A-Share & US ADR) และ DR หุ้นต่างประเทศ พร้อม Smart Confluence แนวรับ-แนวต้าน, Time Machine 10,000 รอบ, AI Chat Bot และพอร์ตจำลอง 360°",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${ibmThai.variable} ${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen antialiased selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
