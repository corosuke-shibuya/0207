import { NextResponse } from "next/server";
import OpenAI from "openai";

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type Tone = "short" | "polite" | "direct";

function fallbackRewrite(message: string, tone: Tone) {
  const compact = message.replace(/\s+/g, " ").trim();
  if (tone === "short") {
    return compact.length > 90 ? `${compact.slice(0, 90)}...` : compact;
  }
  if (tone === "polite") {
    return `お疲れさまです。${compact} ご確認いただけると助かります。`;
  }
  return `結論です。${compact}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const tone = body?.tone as Tone;

    if (!message || !tone || !["short", "polite", "direct"].includes(tone)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!client) {
      return NextResponse.json({ message: fallbackRewrite(message, tone) });
    }

    const toneInstruction =
      tone === "short"
        ? "短く。120文字以内。"
        : tone === "polite"
          ? "ていねい。柔らかい依頼表現。"
          : "率直。結論先行。";

    const response = await client.responses.create({
      model,
      temperature: 0.4,
      input: [
        {
          role: "system",
          content:
            "あなたは日本語のビジネス文面リライターです。意味は変えず、指定トーンに変換してください。出力は文面のみ。",
        },
        {
          role: "user",
          content: `変換条件: ${toneInstruction}\n原文: ${message}`,
        },
      ],
    });

    const rewritten = response.output_text?.trim();
    if (!rewritten) {
      return NextResponse.json({ message: fallbackRewrite(message, tone) });
    }

    return NextResponse.json({ message: rewritten });
  } catch {
    return NextResponse.json({ error: "Rewrite failed" }, { status: 500 });
  }
}
