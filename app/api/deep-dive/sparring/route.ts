import { NextResponse } from "next/server";
import { generateSparringTurn } from "@/lib/deep-dive/sparring";
import { pickContextNoteIds } from "@/lib/deep-dive/context";
import { upsertSparringSession } from "@/lib/deep-dive/store";
import { SparringMode } from "@/lib/deep-dive/types";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

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

    if (!personId || !scenario || history.length === 0) {
      return NextResponse.json({ error: "personId, scenario, history are required" }, { status: 400 });
    }

    const contextNoteIds = await pickContextNoteIds(scenario, "PRE", personId);

    const result = await generateSparringTurn({
      sessionId: sessionId || undefined,
      personId,
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
      result.follow_up_question ? `確認質問: ${result.follow_up_question}` : "",
      "",
      `相手の反応見立て: ${result.roleplay_reply}`,
      "",
      `コーチ補足: ${result.coach_feedback}`,
    ]
      .filter(Boolean)
      .join("\n");
    const turns = [...history, { role: "assistant" as const, content: assistantText }];
    const saved = await upsertSparringSession({
      sessionId: sessionId || undefined,
      personId,
      goal,
      scenario,
      mode,
      contextNoteIds,
      turns,
      analysisSummary: result.analysis_summary,
      recommendations: result.recommendations,
      followUpQuestion: result.follow_up_question,
      goalProgress: result.goal_progress,
      nextOptions: result.next_options,
      riskNote: result.risk_note,
    });

    return NextResponse.json({ ...result, sessionId: saved.sessionId });
  } catch {
    return NextResponse.json({ error: "Failed to generate sparring turn" }, { status: 500 });
  }
}
