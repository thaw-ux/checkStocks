import { extractText } from "unpdf";
import type { PdfQuoteExtract } from "../types";

const MAX_PDF_BYTES = 6 * 1024 * 1024; // 6MB cap for Vercel memory safety

function cleanPdfText(raw: string, maxChars = 2400): string {
  const collapsed = raw
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, maxChars).trim()}...`;
}

export async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer | Uint8Array,
  maxChars = 4000
): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("ไฟล์ PDF มีขนาดใหญ่เกิน 6MB กรุณาใช้ไฟล์บทวิเคราะห์ขนาดไม่เกิน 6MB");
  }
  const { text } = await extractText(bytes, { mergePages: true });
  return cleanPdfText(Array.isArray(text) ? text.join("\n") : text, maxChars);
}

export async function extractPdfQuoteFromUrl(params: {
  broker: string;
  title: string;
  url: string;
  timeoutMs?: number;
}): Promise<PdfQuoteExtract> {
  const { broker, title, url, timeoutMs = 4500 } = params;
  const now = new Date().toISOString();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/pdf,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return {
        broker,
        title,
        url,
        excerpt: `ไม่สามารถดึงไฟล์ PDF ได้ (HTTP ${res.status})`,
        extractedAt: now,
        status: "unavailable",
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      return {
        broker,
        title,
        url,
        excerpt: "ลิงก์ต้นทางเป็นหน้าเว็บไม่ใช่ไฟล์ PDF โดยตรง",
        extractedAt: now,
        status: "unavailable",
      };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_PDF_BYTES) {
      return {
        broker,
        title,
        url,
        excerpt: "ข้ามไฟล์เนื่องจากขนาดเกิน 6MB",
        extractedAt: now,
        status: "unavailable",
      };
    }

    const extracted = await extractTextFromPdfBuffer(buf, 1600);
    return {
      broker,
      title,
      url,
      excerpt: extracted || "ไม่พบข้อความที่อ่านได้ใน PDF (อาจเป็นไฟล์ภาพสแกน)",
      extractedAt: now,
      status: extracted ? "extracted" : "unavailable",
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      broker,
      title,
      url,
      excerpt: isTimeout
        ? "ข้ามไฟล์เนื่องจากโหลดเกินเวลาที่กำหนด (Timeout Guard)"
        : "ไม่สามารถสกัดข้อความจาก PDF ได้",
      extractedAt: now,
      status: isTimeout ? "timeout" : "unavailable",
    };
  }
}
