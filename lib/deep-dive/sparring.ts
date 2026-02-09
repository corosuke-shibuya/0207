import OpenAI from "openai";
import { getPerson, listRecentSparringSnapshots } from "@/lib/deep-dive/store";
import { Person } from "@/lib/deep-dive/types";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type SparringContextRef = {
  sessionId: string;
  createdAt: string;
  goal?: string;
  scenario: string;
};

export type SparringResponse = {
  roleplay_reply: string;
  coach_feedback: string;
  next_options: string[];
  risk_note: string;
  goal_progress: "low" | "mid" | "high";
  context_refs: SparringContextRef[];
};

const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const RESPONSE_SCHEMA = {
  name: "sparring_response",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["roleplay_reply", "coach_feedback", "next_options", "risk_note", "goal_progress"],
    properties: {
      roleplay_reply: { type: "string" },
      coach_feedback: { type: "string" },
      next_options: {
        type: "array",
        items: { type: "string" },
      },
      risk_note: { type: "string" },
      goal_progress: {
        type: "string",
        enum: ["low", "mid", "high"],
      },
    },
  },
} as const;

function normalizeForCompare(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[「」『』（）()【】\[\]、。.,!?！？:：;；\-]/g, "");
}

function bigrams(text: string) {
  const normalized = normalizeForCompare(text);
  const set = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    set.add(normalized.slice(i, i + 2));
  }
  return set;
}

function overlapRatio(a: string, b: string) {
  const aSet = bigrams(a);
  const bSet = bigrams(b);
  if (aSet.size === 0 || bSet.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) {
      intersection += 1;
    }
  }
  return intersection / Math.min(aSet.size, bSet.size);
}

function validateResponseShape(parsed: SparringResponse) {
  if (!parsed.roleplay_reply?.trim() || !parsed.coach_feedback?.trim()) {
    return false;
  }
  const options = (parsed.next_options ?? []).filter((option) => option.trim().length > 0);
  if (options.length < 2) {
    return false;
  }
  const uniqueOptions = new Set(options.map((option) => normalizeForCompare(option)));
  if (uniqueOptions.size < 2) {
    return false;
  }
  return true;
}

function evaluateQuality(params: {
  parsed: SparringResponse;
  lastUser: string;
  previousAssistant: string;
}) {
  const combined = `${params.parsed.roleplay_reply}\n${params.parsed.coach_feedback}\n${params.parsed.next_options.join("\n")}`;
  const relevance =
    params.lastUser.trim().length < 8 ? 1 : overlapRatio(combined, params.lastUser);
  const repetition = params.previousAssistant
    ? overlapRatio(combined, params.previousAssistant)
    : 0;
  const pass = relevance >= 0.06 && repetition <= 0.82;
  return { pass, relevance, repetition };
}

function evaluatePersonFit(parsed: SparringResponse, person: Person) {
  const a = person.typeAxes;
  const options = parsed.next_options ?? [];
  const avgOptionLength =
    options.length === 0 ? 0 : options.reduce((sum, option) => sum + option.length, 0) / options.length;
  const combined = `${parsed.roleplay_reply}\n${parsed.coach_feedback}\n${options.join("\n")}`;

  let score = 0;
  let checks = 0;

  checks += 1;
  if (a.verbosity === "short") {
    if (avgOptionLength <= 48) {
      score += 1;
    }
  } else if (avgOptionLength >= 24) {
    score += 1;
  }

  checks += 1;
  const hasSoftener = /(でしょうか|いただける|もし|念のため|差し支えなければ)/.test(combined);
  if (a.directness === "indirect" ? hasSoftener : !hasSoftener || /(結論|先に|明確|判断)/.test(combined)) {
    score += 1;
  }

  checks += 1;
  const hasLogicalMarker = /(理由|根拠|事実|前提|影響|比較|選択肢)/.test(combined);
  const hasEmotionalMarker = /(不安|安心|配慮|気持ち|納得|温度感)/.test(combined);
  if (a.emphasis === "logical" ? hasLogicalMarker : hasEmotionalMarker) {
    score += 1;
  }

  checks += 1;
  const hasFastDecisionShape = /(結論|優先|どちら|決める|先に)/.test(combined);
  const hasSlowDecisionShape = /(前提|確認|追加情報|段階|整理)/.test(combined);
  if (a.decisionSpeed === "fast" ? hasFastDecisionShape : hasSlowDecisionShape) {
    score += 1;
  }

  return { pass: score / checks >= 0.5, score, checks };
}

function buildPersonGuidance(person: Person) {
  const a = person.typeAxes;
  const priorityMap = {
    outcome: "成果・進捗を最優先。抽象論より実行案。",
    relationship: "関係維持を重視。配慮と合意形成が重要。",
    accuracy: "定義と根拠を重視。曖昧表現は避ける。",
    speed: "意思決定スピード重視。選択肢は絞る。",
  } as const;
  const directnessMap = {
    direct: "直接的で明確な言い方を好む。",
    indirect: "婉曲で角の立たない言い方を好む。",
  } as const;
  const verbosityMap = {
    short: "短文で要点先出し。",
    long: "背景も含めた丁寧な説明が有効。",
  } as const;
  const emphasisMap = {
    emotional: "感情面への配慮を入れる。",
    logical: "論点と根拠を明確にする。",
  } as const;
  const stanceMap = {
    defensive: "反論を想定し、先回りして根拠を補強する。",
    cooperative: "共通目的を先に置くと通りやすい。",
  } as const;
  const decisionSpeedMap = {
    fast: "判断は早い。結論と選択肢を先に。",
    slow: "判断は慎重。前提確認を丁寧に。",
  } as const;

  return [
    `相手名: ${person.name}`,
    person.role ? `役割: ${person.role}` : "",
    person.relationship ? `関係: ${person.relationship}` : "",
    `相手傾向: ${priorityMap[a.priority]} ${directnessMap[a.directness]} ${verbosityMap[a.verbosity]} ${emphasisMap[a.emphasis]} ${stanceMap[a.stance]} ${decisionSpeedMap[a.decisionSpeed]}`,
    "出力スタイル要件:",
    `- roleplay_reply: ${a.verbosity === "short" ? "1〜2文で短く" : "2〜4文で背景も含める"}`,
    `- coach_feedback: ${a.emphasis === "logical" ? "論点と根拠を明示" : "配慮と伝わり方を明示"}`,
    `- next_options: ${a.directness === "direct" ? "結論先出しで明確に" : "角を立てない相談形で"} 3案`,
    person.memo ? `追加メモ: ${person.memo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function pickBySeed<T>(items: T[], seedText: string): T {
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length];
}

function fallback(input: {
  goal: string;
  scenario: string;
  lastUser: string;
  previousAssistant: string;
  person: Person;
}): SparringResponse {
  const axes = input.person.typeAxes;
  const personLabel = input.person.role
    ? `${input.person.name}（${input.person.role}）`
    : input.person.name;
  const shortUser = input.lastUser.trim().slice(0, 140) || "（まだ返信なし）";
  const hasQuestion = /[?？]/.test(input.lastUser);
  const hasStrongWords = /(退職|辞め|難しい|無理|避けたい|不安|懸念)/.test(input.lastUser);
  const replySeed = `${input.lastUser}|${input.scenario}|${input.goal}|${personLabel}|${input.previousAssistant}`;
  const questionReplies = [
    `${personLabel}の立場なら「質問には答える。加えて、結論と期限を明確にしてほしい」と返す可能性が高いです。`,
    `${personLabel}の立場なら「問いの意図は理解。判断に必要な条件を先に示してほしい」と返す可能性が高いです。`,
  ];
  const concernReplies = [
    `${personLabel}の立場なら「懸念は理解した。まず打った手と残るリスクを分けて示してほしい」と返す可能性が高いです。`,
    `${personLabel}の立場なら「課題認識は共有。次は実施済み対応と不足点を整理してほしい」と返す可能性が高いです。`,
  ];
  const neutralReplies = [
    `${personLabel}の立場なら「方向性は理解。意思決定に必要な材料を短く出してほしい」と返す可能性が高いです。`,
    `${personLabel}の立場なら「提案は受け取った。比較軸をそろえて説明してほしい」と返す可能性が高いです。`,
  ];
  const dynamicReply = hasQuestion
    ? pickBySeed(questionReplies, replySeed)
    : hasStrongWords
      ? pickBySeed(concernReplies, replySeed)
      : pickBySeed(neutralReplies, replySeed);

  const phrasing = axes.directness === "indirect" ? "相談形で" : "結論先出しで";
  const optionA =
    axes.verbosity === "short"
      ? `いまの発言を踏まえ、事実を3点だけ${phrasing}共有します。`
      : `いまの発言を踏まえ、背景・事実・現状リスクを分けて${phrasing}共有します。`;
  const optionB =
    axes.decisionSpeed === "fast"
      ? "維持策と影響最小化策を並べるので、優先順位を今ここで決めてください。"
      : "維持策と影響最小化策を並べるので、判断軸を確認した上で優先順位を決めたいです。";
  const optionC =
    axes.emphasis === "emotional"
      ? "部長視点で、チームの安心感を保つために不足している配慮は何でしょうか。"
      : "部長視点で、意思決定に足りない情報は何でしょうか。";
  const coachingVariants = hasQuestion
    ? [
        "質問形式は有効です。次は『判断に必要な2点』を先に固定して、相手が答えやすい形にしてください。",
        "問いの立て方は良いです。次は先に結論候補を1つ置いて、確認質問を1つだけ添えてください。",
      ]
    : [
        "主張は伝わっています。次は『事実→選択肢→確認したい判断軸』の順で、1段落ずつ短くしてください。",
        "論点は明確です。次は『現状リスク→打ち手→意思決定依頼』の3行構成で提示してください。",
      ];
  const coachFeedback = pickBySeed(coachingVariants, `${replySeed}|coach`);

  return {
    roleplay_reply: `${dynamicReply}\n\nあなたの直近発言: ${shortUser}`,
    coach_feedback: coachFeedback,
    next_options: [optionA, optionB, optionC],
    risk_note: `目的「${input.goal || "未設定"}」に対して、意図が強すぎる表現は政治的リスクになります。`,
    goal_progress: input.lastUser.length > 80 ? "high" : input.lastUser.length > 30 ? "mid" : "low",
    context_refs: [],
  };
}

function parseJsonObject(text: string): SparringResponse | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(raw.slice(start, end + 1)) as SparringResponse;
  } catch {
    return null;
  }
}

export async function generateSparringTurn(input: {
  sessionId?: string;
  personId: string;
  goal: string;
  scenario: string;
  history: ChatTurn[];
}): Promise<SparringResponse> {
  const person = await getPerson(input.personId);
  if (!person) {
    throw new Error("Person not found");
  }
  const recent = (await listRecentSparringSnapshots(input.personId, 3))
    .filter((item) => item.sessionId !== input.sessionId)
    .slice(0, 2);
  const contextRefs = recent.map((item) => ({
    sessionId: item.sessionId,
    createdAt: item.createdAt,
    goal: item.goal,
    scenario: item.scenario,
  }));

  const lastUser = [...input.history].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const previousAssistant = [...input.history].reverse().find((turn) => turn.role === "assistant")?.content ?? "";

  if (!client) {
    return {
      ...fallback({
        goal: input.goal,
        scenario: input.scenario,
        lastUser,
        previousAssistant,
        person,
      }),
      context_refs: contextRefs,
    };
  }

  const prompt = [
    "あなたはコミュニケーション壁打ちコーチ。",
    "1) 相手役としてリアルな返答を1つ作る。",
    "2) コーチとして改善ポイントを短く返す。",
    "3) 次に言う一言の選択肢を3つ返す（互いに意図が異なる案にする）。",
    "禁止: 攻撃・威圧・不誠実な誘導。",
    "会話は実務的、短く、次に動ける形で。",
    "最重要: 直近ユーザー発話に必ず具体的に反応し、前回と同じ文を繰り返さない。",
    "roleplay_reply と coach_feedback の冒頭1文は、直近ユーザー発話の要点を言い換えてから始める。",
    "相手傾向に合わせて、語調・長さ・判断の進め方を調整する。",
    `相談ゴール: ${input.goal || "未設定"}`,
    `状況: ${input.scenario}`,
    buildPersonGuidance(person),
    `同一相手の過去壁打ち要約: ${JSON.stringify(
      recent.map((item) => ({
        date: item.createdAt,
        goal: item.goal,
        scenario: item.scenario.slice(0, 120),
        lastUser: item.lastUser.slice(0, 120),
        lastAssistant: item.lastAssistant.slice(0, 120),
        risk: item.riskNote,
      })),
    )}`,
    `直近ユーザー発話: ${lastUser}`,
    `履歴: ${JSON.stringify(input.history.slice(-8))}`,
  ].join("\n");

  for (let i = 0; i < 3; i += 1) {
    const strictHint = i > 0 ? "厳密JSONのみ返してください。" : "";
    const retryHint =
      i === 0
        ? ""
        : "前回出力は文脈追従または差分が不足。直近ユーザー発話により具体的に反応し、前回と表現を変えること。";
    try {
      const response = await client.responses.create({
        model,
        temperature: 0.5 + i * 0.15,
        input: `${prompt}\n${retryHint}\n${strictHint}`,
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
      if (parsed && validateResponseShape(parsed)) {
        const quality = evaluateQuality({ parsed, lastUser, previousAssistant });
        const personFit = evaluatePersonFit(parsed, person);
        if (!quality.pass || !personFit.pass) {
          continue;
        }
        return {
          ...parsed,
          next_options: (parsed.next_options ?? []).slice(0, 3),
          context_refs: contextRefs,
        };
      }
    } catch {
      // retry once
    }
  }

  return {
    ...fallback({
      goal: input.goal,
      scenario: input.scenario,
      lastUser,
      previousAssistant,
      person,
    }),
    context_refs: contextRefs,
  };
}
