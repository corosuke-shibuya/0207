import { NextResponse } from "next/server";
import { generateSparringTurn } from "@/lib/deep-dive/sparring";
import { pickContextNoteIds } from "@/lib/deep-dive/context";
import { upsertSparringSession } from "@/lib/deep-dive/store";

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
      history?: unknown;
    };
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const personId = typeof body?.personId === "string" ? body.personId.trim() : "";
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
    const scenario = typeof body?.scenario === "string" ? body.scenario.trim() : "";
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
      history,
      contextNoteIds,
    });

    const assistantText = `相手役: ${result.roleplay_reply}\n\nコーチ: ${result.coach_feedback}`;
    const turns = [...history, { role: "assistant" as const, content: assistantText }];
    const saved = await upsertSparringSession({
      sessionId: sessionId || undefined,
      personId,
      goal,
      scenario,
      contextNoteIds,
      turns,
      goalProgress: result.goal_progress,
      nextOptions: result.next_options,
      riskNote: result.risk_note,
    });

    return NextResponse.json({ ...result, sessionId: saved.sessionId });
  } catch {
    return NextResponse.json({ error: "Failed to generate sparring turn" }, { status: 500 });
  }
}
