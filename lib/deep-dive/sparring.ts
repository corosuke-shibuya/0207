import OpenAI from "openai";
import { getPerson, getUserProfile, listNotes, listRecentSparringSnapshots } from "@/lib/deep-dive/store";
import { Note, Person, SparringMode, UserProfile } from "@/lib/deep-dive/types";

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
  mode: SparringMode;
  analysis_summary: string;
  recommendations: string[];
  follow_up_question: string;
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
    required: [
      "mode",
      "analysis_summary",
      "recommendations",
      "follow_up_question",
      "roleplay_reply",
      "coach_feedback",
      "next_options",
      "risk_note",
      "goal_progress",
    ],
    properties: {
      mode: {
        type: "string",
        enum: ["PRE_REFLECT", "PRE_STRATEGY", "FACILITATION"],
      },
      analysis_summary: { type: "string" },
      recommendations: {
        type: "array",
        items: { type: "string" },
      },
      follow_up_question: { type: "string" },
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
  if (!parsed.analysis_summary?.trim() || !parsed.coach_feedback?.trim()) {
    return false;
  }
  if (parsed.mode === "FACILITATION" && !parsed.roleplay_reply?.trim()) {
    return false;
  }
  const recommendations = (parsed.recommendations ?? []).filter((item) => item.trim().length > 0);
  if (recommendations.length < 2) {
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
  const combined = `${params.parsed.analysis_summary}\n${params.parsed.recommendations.join("\n")}\n${params.parsed.roleplay_reply}\n${params.parsed.coach_feedback}\n${params.parsed.next_options.join("\n")}`;
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
    politics: "見え方・評価・支持者への影響を重視。筋の良さだけでは動かない。",
    logic: "正しさと整合性を重視。矛盾のない説明が最優先。",
    risk: "責任回避と炎上回避を重視。前例・監査耐性が重要。",
    outcome: "成果・進捗を最優先。抽象論より実行案。",
    speed: "意思決定スピード重視。選択肢は絞る。",
    harmony: "場の調和と合意を重視。衝突回避と関係維持が重要。",
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

function buildUserGuidance(userProfile: UserProfile | null) {
  if (!userProfile) {
    return "";
  }

  const a = userProfile.typeAxes;
  const priorityMap = {
    politics: "見え方・評価を重視する傾向。",
    logic: "正しさと整合性を重視する傾向。論理で押しすぎると相手が引く場面に注意。",
    risk: "リスク回避を重視する傾向。慎重すぎて判断が遅れる場面に注意。",
    outcome: "成果・スピードを重視する傾向。結論を急いで相手を置き去りにする場面に注意。",
    speed: "意思決定スピードを重視する傾向。拙速になる場面に注意。",
    harmony: "場の調和を重視する傾向。自分の意見を抑えすぎる場面に注意。",
  } as const;
  const directnessMap = {
    direct: "ストレートに言う傾向。角が立つ場面に注意。",
    indirect: "婉曲に言う傾向。意図が伝わらない場面に注意。",
  } as const;
  const verbosityMap = {
    short: "説明が短い傾向。背景不足で誤解される場面に注意。",
    long: "説明が長い傾向。要点がぼやける場面に注意。",
  } as const;
  const emphasisMap = {
    emotional: "感情配慮を重視する傾向。",
    logical: "論理・根拠を重視する傾向。感情面のケアが後回しになる場面に注意。",
  } as const;
  const stanceMap = {
    defensive: "自分の意見を主張する傾向。対立を生みやすい場面に注意。",
    cooperative: "協調的な傾向。自分の意見を抑えすぎる場面に注意。",
  } as const;
  const decisionSpeedMap = {
    fast: "判断が早い傾向。拙速になる場面に注意。",
    slow: "判断が慎重な傾向。タイミングを逃す場面に注意。",
  } as const;

  return [
    "【ユーザー自身の特性】",
    `ユーザーの名前: ${userProfile.name}`,
    "回答内で「ユーザーは」ではなく、名前で呼ぶこと。",
    priorityMap[a.priority],
    directnessMap[a.directness],
    verbosityMap[a.verbosity],
    emphasisMap[a.emphasis],
    stanceMap[a.stance],
    decisionSpeedMap[a.decisionSpeed],
    userProfile.memo ? `本人の補足: ${userProfile.memo}` : "",
    "",
    "上記を踏まえ、ユーザーの癖や盲点を指摘し、この相手に対してユーザーが特に気をつけるべきポイントを coach_feedback に含めること。",
    "一般的なコミュニケーション論ではなく、「あなたはこういう傾向があるから、この場面ではこう気をつけて」という形で助言すること。",
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
  mode: SparringMode;
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
  const isVague = input.scenario.trim().length < 40 || input.lastUser.trim().length < 20;
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
        "質問形式は有効です。浅くしないために、(1)相手が止まる論点 (2)その論点を前に進める事実 (3)確認したい判断の順で話してください。",
        "問いの立て方は良いです。次は『あなたの提案1行→根拠2点→相手に決めてほしい1点』の型で、会話の主導権を取り戻してください。",
      ]
    : [
        "主張は伝わっています。次は『事実→打ち手→判断依頼』の3段にし、各段で相手が反論しそうな点を1つ先回りしてください。",
        "論点は明確です。次は『何が問題か』より『どう進めるか』を先頭に置き、責任論に流れた時の戻し文を1文だけ準備してください。",
      ];
  const coachFeedback = pickBySeed(coachingVariants, `${replySeed}|coach`);

  const modeLabel = {
    PRE_REFLECT: "事前振り返り",
    PRE_STRATEGY: "事前戦略",
    FACILITATION: "ファシリ支援",
  } as const;

  const modeRecommendations = {
    PRE_REFLECT: [
      "直近の失敗要因を「事実」「解釈」「感情」に分けて1行ずつ整理する。",
      "次の会話で変える点を1つだけ決め、最初の30秒で実行する言い回しを先に用意する。",
      "相手が防衛的になりそうな論点を1つ決め、先回りの一言を準備する。",
    ],
    PRE_STRATEGY: [
      "結論→理由2点→確認事項の順で話す下書きを先に作る。",
      "相手に選ばせる選択肢を2案に絞り、どちらを推すか明示する。",
      "反論されやすい点を1つだけ先出しし、対処案を添える。",
    ],
    FACILITATION: [
      "会議冒頭で「今日決めること・決めないこと」を1分で宣言する。",
      "論点を『方向性 / 戦略 / 戦術』の3層に分け、今どこを話しているか固定する。",
      "発言が散ったら、論点に戻す問いを1つだけ繰り返す。",
    ],
  } as const;

  const followUp = isVague
    ? "一般論を避けるために1点だけ教えてください。今回いちばん避けたい失敗は何ですか？"
    : input.mode === "FACILITATION"
      ? "次回会議で、あなたが最初の1分で置ける論点整理は何にしますか？"
      : "この案を実行する場面は、1on1・定例会議・チャットのどれですか？";

  return {
    mode: input.mode,
    analysis_summary: `${modeLabel[input.mode]}として見ると、直近発話は「${shortUser}」で、主論点は${hasStrongWords ? "リスク処理と意思決定" : "伝達順序と合意形成"}です。`,
    recommendations: modeRecommendations[input.mode].slice(0, 3),
    follow_up_question: followUp,
    roleplay_reply: input.mode === "FACILITATION" ? `${dynamicReply}\n\nあなたの直近発言: ${shortUser}` : "",
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
  personId?: string;
  goal: string;
  scenario: string;
  mode: SparringMode;
  history: ChatTurn[];
  contextNoteIds?: string[];
}): Promise<SparringResponse> {
  const userProfile = await getUserProfile();
  const person =
    (input.personId ? await getPerson(input.personId) : null) ??
    ({
      id: "__none__",
      userId: "local",
      name: "相談対象未指定",
      typeAxes: {
        priority: "logic",
        directness: "direct",
        verbosity: "short",
        emphasis: "logical",
        stance: "cooperative",
        decisionSpeed: "fast",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Person);
  const recent = input.personId
    ? (await listRecentSparringSnapshots(input.personId, 3))
        .filter((item) => item.sessionId !== input.sessionId)
        .slice(0, 2)
    : [];
  const contextRefs = recent.map((item) => ({
    sessionId: item.sessionId,
    createdAt: item.createdAt,
    goal: item.goal,
    scenario: item.scenario,
  }));

  const allNotes = await listNotes(30);
  const contextNotes = (input.contextNoteIds ?? [])
    .map((id) => allNotes.find((note) => note.id === id))
    .filter((note): note is Note => Boolean(note))
    .slice(0, 3)
    .map((note) => ({ id: note.id, body: note.body.slice(0, 100), createdAt: note.createdAt }));

  const lastUser = [...input.history].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const previousAssistant = [...input.history].reverse().find((turn) => turn.role === "assistant")?.content ?? "";

  if (!client) {
    return {
      ...fallback({
        mode: input.mode,
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
    `現在モード: ${input.mode}`,
    ...({
      PRE_REFLECT: [
        "【モード: 事前振り返り】",
        "roleplay_reply は空文字 \"\" にすること。",
        "ユーザーの状況を深く分析し、analysis_summary に固有の事実・人物名・詰まりポイントを書く。",
        "coach_feedback でユーザーの思考の整理を手助けする。「なぜズレたか→どう直すか→次の一言例」の構成。",
        "recommendations に次アクションを2〜3件入れる。",
        "next_options は「ユーザーが次に考えるべき問い」または「次に取れるアプローチの選択肢」を3つ提示する。",
      ],
      PRE_STRATEGY: [
        "【モード: 事前戦略】",
        "roleplay_reply は空文字 \"\" にすること。",
        "状況を踏まえた具体的な作戦を recommendations に書く。",
        "coach_feedback で作戦の弱点と補強案を示す。",
        "next_options は「相手に言う一言目の候補」を意図が異なる3案で提示する。",
        "analysis_summary に状況分析を短く入れる。",
      ],
      FACILITATION: [
        "【モード: ファシリ支援】",
        "相手役として1つだけ返答する。それを roleplay_reply に入れる。コーチとしてのメタ解説は roleplay_reply に混ぜない。",
        "coach_feedback はユーザー発言へのフィードバックのみ。相手役のセリフは含めない。",
        "analysis_summary は最小限でよい。",
        "recommendations に次アクションを2〜3件入れる。",
        "next_options は「ユーザーが次に相手に言う一言の候補」を3つ提示する。",
      ],
    } satisfies Record<SparringMode, string[]>)[input.mode],
    "回答は常にユーザー固有文脈ベース。一般的なマネージャー論・テンプレ論は禁止。",
    "coach_feedback では重要なポイントを **太字（Markdown記法）** で強調すること。",
    "coach_feedback は適切に段落を分け、1段落は2-3文を目安にすること。",
    "2往復目以降は、前回の助言からの進展・変化点を冒頭で明示すること。前回と同じ助言の繰り返しは禁止。新たに深掘りした部分や視点の変化を **太字** で強調すること。",
    "recommendations 配列の各要素に番号（1. 2. 3.）を付けないこと。番号はフロント側で付与する。",
    "follow_up_question は情報が不足している場合のみ1つだけ具体質問を返す。ユーザーの入力で状況・目的・相手が十分に把握できる場合は空文字 \"\" にすること。会話が2往復以上進んだ後は、追加質問よりも具体的な助言を優先する。",
    "曖昧な一般論（例: 〜の可能性があります）だけで終えない。",
    "roleplay_reply はFACILITATIONモード以外では空文字 \"\" を返すこと。ロールプレイ要素を他フィールドに混入させないこと。",
    "coach_feedback は浅い感想禁止。必ず『なぜズレたか→どう直すか→次の一言例』まで書く。",
    "analysis_summary は今回の状況固有名詞・事実・詰まりポイントを必ず含める。",
    "analysis_summary + coach_feedback + recommendations + roleplay_reply の合計は、日本語で500〜2000字に収める。",
    "禁止: 攻撃・威圧・不誠実な誘導。",
    "会話は実務的・中程度の長さ・次に動ける形。寄り添いは軽め。",
    "最重要: 直近ユーザー発話に必ず具体的に反応し、前回と同じ文を繰り返さない。",
    "roleplay_reply と coach_feedback の冒頭1文は、直近ユーザー発話の要点を言い換えてから始める。",
    "相手傾向に合わせて、語調・長さ・判断の進め方を調整する。",
    `相談ゴール: ${input.goal || "未設定"}`,
    `状況: ${input.scenario}`,
    buildPersonGuidance(person),
    buildUserGuidance(userProfile),
    `参照ノート: ${JSON.stringify(contextNotes)}`,
    `同一相手の過去壁打ち要約: ${JSON.stringify(
      recent.map((item) => ({
        date: item.createdAt,
        goal: item.goal,
        scenario: item.scenario.slice(0, 80),
        lastUser: item.lastUser.slice(0, 80),
        lastAssistant: item.lastAssistant.slice(0, 80),
        risk: item.riskNote,
      })),
    )}`,
    `直近ユーザー発話: ${lastUser}`,
    `履歴: ${JSON.stringify(input.history.slice(-4))}`,
  ].join("\n");

  for (let i = 0; i < 2; i += 1) {
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
          recommendations: (parsed.recommendations ?? []).slice(0, 3),
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
      mode: input.mode,
      goal: input.goal,
      scenario: input.scenario,
      lastUser,
      previousAssistant,
      person,
    }),
    context_refs: contextRefs,
  };
}
