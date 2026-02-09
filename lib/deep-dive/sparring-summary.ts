import OpenAI from "openai";
import { SparringSummary, SparringTurn } from "@/lib/deep-dive/types";

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const RESPONSE_SCHEMA = {
  name: "sparring_summary",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["learned_points", "next_actions", "risk_watch"],
    properties: {
      learned_points: { type: "array", items: { type: "string" } },
      next_actions: { type: "array", items: { type: "string" } },
      risk_watch: { type: "array", items: { type: "string" } },
    },
  },
} as const;

function fallbackSummary(turns: SparringTurn[], goal?: string): SparringSummary {
  const userTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.content);
  const lastUser = userTurns[userTurns.length - 1] ?? "";

  return {
    learned_points: [
      goal ? `ゴール「${goal}」に対して、論点整理を先に置くと話が進みやすい。` : "ゴールを先に明示すると会話がぶれにくい。",
      "相手の懸念を先読みして、比較軸を添えると反発を下げやすい。",
      "意見より事実（観測情報）を先に出すと合意形成しやすい。",
    ],
    next_actions: [
      "次回は冒頭30秒で目的・現状・相談点を1セットで伝える。",
      "相手の優先軸（人数維持/業務安定）を質問で確認してから提案する。",
      lastUser ? `最後の発言「${lastUser.slice(0, 32)}...」を短文化して再利用する。` : "使用した表現を1つメモ化して再利用する。",
    ],
    risk_watch: [
      "結論を急ぎすぎると意図が強すぎる印象になる。",
      "代替案がないまま離職前提で話すと政治的リスクが高い。",
      "相手の立場を飛ばすと防衛反応を誘発しやすい。",
    ],
  };
}

function parseJsonObject(text: string): SparringSummary | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(raw.slice(start, end + 1)) as SparringSummary;
  } catch {
    return null;
  }
}

export async function generateSparringSummary(input: {
  goal?: string;
  scenario: string;
  turns: SparringTurn[];
}): Promise<SparringSummary> {
  if (!client) {
    return fallbackSummary(input.turns, input.goal);
  }

  const prompt = [
    "あなたはコミュニケーション壁打ちの振り返りコーチです。",
    "会話ログを要約し、学びを実務で再現できる形にしてください。",
    "learned_points/next_actions/risk_watch を各3件、短く具体に。",
    `ゴール: ${input.goal || "未設定"}`,
    `状況: ${input.scenario}`,
    `会話: ${JSON.stringify(input.turns.slice(-16))}`,
  ].join("\n");

  for (let i = 0; i < 2; i += 1) {
    const strictHint = i === 1 ? "厳密JSONのみ返してください。" : "";
    try {
      const response = await client.responses.create({
        model,
        temperature: 0.4,
        input: `${prompt}\n${strictHint}`,
        text: {
          format: {
            type: "json_schema",
            name: RESPONSE_SCHEMA.name,
            schema: RESPONSE_SCHEMA.schema,
            strict: true,
          },
        },
      });

      const parsed = response.output_text ? parseJsonObject(response.output_text) : null;
      if (parsed) {
        return {
          learned_points: parsed.learned_points.slice(0, 3),
          next_actions: parsed.next_actions.slice(0, 3),
          risk_watch: parsed.risk_watch.slice(0, 3),
        };
      }
    } catch {
      // retry once
    }
  }

  return fallbackSummary(input.turns, input.goal);
}
