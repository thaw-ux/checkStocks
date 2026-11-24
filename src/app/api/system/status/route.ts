import { NextResponse } from "next/server";
import { getFlashModelName, getProModelName, isGeminiConfigured } from "@/lib/ai/gemini";
import { clearCachePrefix } from "@/lib/cache";

export async function GET() {
  return NextResponse.json({
    geminiConfigured: isGeminiConfigured(),
    defaultProModel: getProModelName(),
    defaultFlashModel: getFlashModelName(),
    availableModels: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (วิเคราะห์เชิงลึก & Chat Bot)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (เร็วสูง & ประหยัดโควตา)" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (สำรองความเร็วสูง)" },
    ],
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prefix?: string };
  const cleared = clearCachePrefix(body.prefix);
  return NextResponse.json({ ok: true, cleared });
}
