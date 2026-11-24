import { NextResponse } from "next/server";
import { analyzeNewsImpactAI } from "@/lib/ai/gemini";
import { fetchPublicArticleContent } from "@/lib/data/news";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      text?: string;
      model?: string;
    };

    let combinedText = (body.text ?? "").trim();
    const rawUrl = (body.url ?? "").trim();

    if (rawUrl) {
      const fetched = await fetchPublicArticleContent(rawUrl);
      if (fetched.ok) {
        combinedText = `${fetched.title}\n\n${fetched.text}${combinedText ? `\n\nเพิ่มเติมจากผู้ใช้: ${combinedText}` : ""}`;
      } else if (!combinedText) {
        return NextResponse.json(
          {
            error:
              "ไม่สามารถดึงเนื้อหาจากลิงก์นี้ได้โดยตรง (เว็บต้นทางอาจบล็อกการดึงอัตโนมัติ) กรุณาคัดลอกข้อความข่าวมาวางแทนครับ",
          },
          { status: 422 }
        );
      }
    }

    if (combinedText.length < 10) {
      return NextResponse.json(
        { error: "กรุณาใส่ลิงก์ข่าวหรือข้อความข่าวอย่างน้อย 10 ตัวอักษร" },
        { status: 400 }
      );
    }

    const result = await analyzeNewsImpactAI({
      text: combinedText,
      sourceUrl: rawUrl || undefined,
      modelOverride: body.model,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "วิเคราะห์ข่าวไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
