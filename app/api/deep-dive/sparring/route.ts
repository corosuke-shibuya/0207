import { NextResponse } from "next/server";
import { generateSparringTurn } from "@/lib/deep-dive/sparring";
import { pickContextNoteIds } from "@/lib/deep-dive/context";
import { upsertSparringSession } from "@/lib/deep-dive/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const personId = typeof body?.personId === "string" ? body.personId.trim() : "";
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
    const scenario = typeof body?.scenario === "string" ? body.scenario.trim() : "";
    const history = Array.isArray(body?.history)
      ? body.history
          .map((turn) => ({
            role: turn?.role === "assistant" ? "assistant" : "user",
            content: typeof turn?.content === "string" ? turn.content : "",
          }))
          .filter((turn) => turn.content.trim().length > 0)
      : [];

    if (!personId || !scenario || history.length === 0) {
      return NextResponse.json({ error: "personId, scenario, history are required" }, { status: 400 });
    }

    const result = await generateSparringTurn({
      sessionId: sessionId || undefined,
      personId,
      goal,
      scenario,
      history,
    });

    const assistantText = `相手役: ${result.roleplay_reply}\n\nコーチ: ${result.coach_feedback}`;
    const turns = [...history, { role: "assistant" as const, content: assistantText }];
    const contextNoteIds = await pickContextNoteIds(scenario, "PRE", personId);
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
