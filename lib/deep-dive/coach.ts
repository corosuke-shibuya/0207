import OpenAI from "openai";
import { getPerson, listNotes, listSessions } from "@/lib/deep-dive/store";
import { ArtifactPayload, CoachRequest, Note } from "@/lib/deep-dive/types";

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const RESPONSE_SCHEMA = {
  name: "coaching_bundle",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["strategy", "drafts", "expected_reactions"],
    properties: {
      strategy: {
        type: "object",
        additionalProperties: false,
        required: ["goal", "principles", "do", "dont", "structure"],
        properties: {
          goal: { type: "string" },
          principles: { type: "array", items: { type: "string" } },
          do: { type: "array", items: { type: "string" } },
          dont: { type: "array", items: { type: "string" } },
          structure: { type: "array", items: { type: "string" } },
        },
      },
      drafts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tone", "message", "why_it_works", "risks"],
          properties: {
            tone: { type: "string" },
            message: { type: "string" },
            why_it_works: { type: "string" },
            risks: { type: "string" },
          },
        },
      },
      expected_reactions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["reaction", "how_to_respond"],
          properties: {
            reaction: { type: "string" },
            how_to_respond: { type: "string" },
          },
        },
      },
      postmortem: {
        type: "object",
        additionalProperties: false,
        required: ["what_happened", "hypotheses", "next_time_plan", "micro_skill"],
        properties: {
          what_happened: { type: "string" },
          hypotheses: { type: "array", items: { type: "string" } },
          next_time_plan: { type: "array", items: { type: "string" } },
          micro_skill: { type: "array", items: { type: "string" } },
        },
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const;

function fallbackPayload(kind: "PRE" | "POST", goal?: string): ArtifactPayload {
  return {
    strategy: {
      goal: goal || "相手に伝わる形で前進させる",
      principles: [
        "結論を先に置く",
        "相手に合わせて情報量を調整する",
        "相手が選びやすい選択肢を出す",
      ],
      do: [
        "1文目で目的を明示する",
        "理由は2つまでに絞る",
        "最後に次アクションを確認する",
      ],
      dont: ["背景説明を長くしすぎる", "相手の反応を決めつける"],
      structure: ["目的", "背景(最小)", "提案", "確認したいこと"],
    },
    drafts: [
      {
        tone: "フラット",
        message:
          "相談です。結論から共有すると、A案で進めるのが最適だと考えています。理由は2点で、1) 納期に間に合う 2) 影響範囲が限定的です。懸念があればここで調整したいです。",
        why_it_works: "結論先行で判断コストを下げ、相手に修正余地を残せる。",
        risks: "反対意見が強い場合は背景不足に見える可能性。",
      },
      {
        tone: "ていねい",
        message:
          "お時間ありがとうございます。先に結論だけお伝えすると、今回はA案で進めるのが良いと考えています。理由は2点あります。必要であれば詳細もすぐ共有します。",
        why_it_works: "配慮を示しつつ主張が埋もれない。",
        risks: "曖昧に見えた場合は次の一手を明確にする必要がある。",
      },
    ],
    expected_reactions: [
      { reaction: "根拠が弱いと言われる", how_to_respond: "比較軸を1つ追加して、A/Bの差を短く示す。" },
      { reaction: "すぐ決めたいと言われる", how_to_respond: "選択肢を2つに絞り、推奨を明言する。" },
    ],
    ...(kind === "POST"
      ? {
          postmortem: {
            what_happened: "意図はあったが、伝える順序で誤解が生まれた。",
            hypotheses: [
              "結論が遅く、相手が防衛的になった",
              "相手に合わせた情報量調整が不足した",
            ],
            next_time_plan: [
              "冒頭30秒で目的と結論を言う",
              "相手の懸念を先に確認してから提案する",
              "最後に合意事項を1文で再確認する",
            ],
            micro_skill: ["ワンセンテンス要約", "確認質問を1つ入れる"],
          },
        }
      : {}),
    assumptions: ["入力情報が短いため、典型パターンを前提に提案しています。"],
  };
}

function trimNote(note: Note) {
  return {
    id: note.id,
    body: note.body.slice(0, 220),
    createdAt: note.createdAt,
  };
}

function pickPromptNotes(allNotes: Note[], contextNoteIds?: string[]) {
  if (!contextNoteIds || contextNoteIds.length === 0) {
    return allNotes.slice(0, 6);
  }

  const selected = contextNoteIds
    .map((id) => allNotes.find((note) => note.id === id))
    .filter((note): note is Note => Boolean(note))
    .slice(0, 6);

  return selected.length > 0 ? selected : allNotes.slice(0, 6);
}

function buildPrompt(input: {
  request: CoachRequest;
  person: NonNullable<Awaited<ReturnType<typeof getPerson>>>;
  promptNotes: { id: string; body: string; createdAt: string }[];
  similarSessions: { kind: string; inputText: string; createdAt: string }[];
}) {
  const { request, person, promptNotes, similarSessions } = input;

  return [
    "あなたはコミュニケーション助言コーチです。",
    "短く、具体的で、すぐ真似できる助言を出してください。精神論は禁止。",
    "曖昧な情報でも動ける提案を2-3案で出す。",
    "トーンは軽く圧をかけない。ただし実務的。",
    "配列は各3-5件。",
    request.kind === "POST"
      ? "POSTモード: postmortemを必ず含める。"
      : "PREモード: postmortemは不要。",
    `相談モード: ${request.kind}`,
    `今回の目的: ${request.goal || "未指定"}`,
    `今回の状況: ${request.inputText}`,
    `相手情報: ${JSON.stringify(person)}`,
    request.contextNoteIds?.length
      ? `参照ノートソース: contextNoteIds(${request.contextNoteIds.length}件)優先`
      : "参照ノートソース: 直近ノート優先",
    `参照ノート: ${JSON.stringify(promptNotes)}`,
    `類似セッション: ${JSON.stringify(similarSessions)}`,
  ].join("\n");
}

function parsePayload(text: string): ArtifactPayload | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const raw = fence?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(start, end + 1)) as ArtifactPayload;
  } catch {
    return null;
  }
}

export async function generateCoachingBundle(request: CoachRequest): Promise<{
  payload: ArtifactPayload;
  model: string;
}> {
  const person = await getPerson(request.personId);
  if (!person) {
    throw new Error("相手が見つかりません");
  }

  const allNotes = await listNotes(80);
  const promptNotes = pickPromptNotes(allNotes, request.contextNoteIds).map(trimNote);
  const similarSessions = (await listSessions())
    .filter((row) => row.personId === request.personId)
    .slice(0, 3)
    .map((row) => ({ kind: row.kind, inputText: row.inputText, createdAt: row.createdAt }));

  const prompt = buildPrompt({ request, person, promptNotes, similarSessions });

  if (!client) {
    return {
      payload: fallbackPayload(request.kind, request.goal),
      model: "fallback-local",
    };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const strictJsonHint =
      attempt === 1 ? "前回の出力に不備がありました。厳密JSONのみを返してください。" : "";

    try {
      const response = await client.responses.create({
        model,
        temperature: 0.5,
        input: `${prompt}\n${strictJsonHint}`,
        text: {
          format: {
            type: "json_schema",
            name: RESPONSE_SCHEMA.name,
            schema: RESPONSE_SCHEMA.schema,
            strict: true,
          },
        },
      });

      const outputText = response.output_text?.trim();
      const parsed = outputText ? parsePayload(outputText) : null;
      if (parsed) {
        return { payload: parsed, model };
      }
    } catch {
      // Retry once, then fallback.
    }
  }

  return {
    payload: fallbackPayload(request.kind, request.goal),
    model: `${model}-fallback`,
  };
}
