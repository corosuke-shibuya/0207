import { NextResponse } from "next/server";
import { generateSparringTurn } from "@/lib/deep-dive/sparring";
import { pickContextNoteIds } from "@/lib/deep-dive/context";
import { upsertSparringSession } from "@/lib/deep-dive/store";
import { SparringMode } from "@/lib/deep-dive/types";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

function normalizeLength(text: string) {
  const MIN = 500;
  const MAX = 2000;
  if (text.length > MAX) {
    return `${text.slice(0, MAX - 1)}…`;
  }
  if (text.length >= MIN) {
    return text;
  }
  const filler = [
    "",
    "補足:",
    "- 上記の推奨行動は、次の1回で全部やる必要はありません。まずは1つ目だけ実行し、反応を見て2つ目を追加してください。",
    "- 相手が想定外の反応をした場合は、結論を繰り返した上で『何を優先して決めるべきか』を1点だけ確認してください。",
    "- 実行後に、うまくいった一言とうまくいかなかった一言を1つずつ記録すると、次回の再現性が上がります。",
  ].join("\n");
  return `${text}\n${filler}`.slice(0, MAX);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: unknown;
      personId?: unknown;
      goal?: unknown;
      scenario?: unknown;
      mode?: unknown;
      history?: unknown;
    };
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const personId = typeof body?.personId === "string" ? body.personId.trim() : "";
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
    const scenario = typeof body?.scenario === "string" ? body.scenario.trim() : "";
    const mode: SparringMode =
      body?.mode === "PRE_REFLECT" || body?.mode === "FACILITATION" ? body.mode : "PRE_STRATEGY";
    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: ChatTurn[] = rawHistory
      .map((turn: unknown) => {
        const item = turn as { role?: unknown; content?: unknown };
        return {
          role: (item?.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: typeof item?.content === "string" ? item.content : "",
        };
      })
      .filter((turn: { content: string }) => turn.content.trim().length > 0);

    if (!scenario || history.length === 0) {
      return NextResponse.json({ error: "scenario, history are required" }, { status: 400 });
    }

    const contextNoteIds = await pickContextNoteIds(scenario, "PRE", personId || "");

    const result = await generateSparringTurn({
      sessionId: sessionId || undefined,
      personId: personId || undefined,
      goal,
      scenario,
      mode,
      history,
      contextNoteIds,
    });

    const assistantText = [
      `分析: ${result.analysis_summary}`,
      "",
      "推奨行動:",
      ...result.recommendations.map((item, index) => `${index + 1}. ${item}`),
      "",
      `あなたの特徴: ${result.user_pattern}`,
      "",
      result.follow_up_question ? `確認質問: ${result.follow_up_question}` : "",
      "",
      `コーチ解説: ${result.coach_feedback}`,
      "",
      `想定反応（必要なら使用）: ${result.roleplay_reply}`,
    ]
      .filter(Boolean)
      .join("\n");
    const normalizedAssistantText = normalizeLength(assistantText);
    const turns = [...history, { role: "assistant" as const, content: normalizedAssistantText }];
    const saved = await upsertSparringSession({
      sessionId: sessionId || undefined,
      personId: personId || undefined,
      goal,
      scenario,
      mode,
      contextNoteIds,
      turns,
      analysisSummary: result.analysis_summary,
      recommendations: result.recommendations,
      userPattern: result.user_pattern,
      followUpQuestion: result.follow_up_question,
      goalProgress: result.goal_progress,
      nextOptions: result.next_options,
      riskNote: result.risk_note,
    });

    return NextResponse.json({
      sessionId: saved.sessionId,
      assistant_text: normalizedAssistantText,
      analysis_summary: result.analysis_summary,
      recommendations: result.recommendations,
      user_pattern: result.user_pattern,
      coach_feedback: result.coach_feedback,
      next_options: result.next_options,
      follow_up_question: result.follow_up_question,
      roleplay_reply: result.roleplay_reply,
      risk_note: result.risk_note,
      mode: result.mode,
      goal_progress: result.goal_progress,
      context_refs: result.context_refs,
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate sparring turn" }, { status: 500 });
  }
}
