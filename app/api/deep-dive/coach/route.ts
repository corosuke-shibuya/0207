import { NextResponse } from "next/server";
import { pickContextNoteIds } from "@/lib/deep-dive/context";
import { generateCoachingBundle } from "@/lib/deep-dive/coach";
import { attachArtifact, createSession } from "@/lib/deep-dive/store";
import { SessionKind } from "@/lib/deep-dive/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = body?.kind === "POST" ? "POST" : "PRE";
    const personId = typeof body?.personId === "string" ? body.personId : "";
    const inputText = typeof body?.inputText === "string" ? body.inputText.trim() : "";
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";

    if (!personId || !inputText) {
      return NextResponse.json({ error: "personId and inputText are required" }, { status: 400 });
    }

    const contextNoteIds = await pickContextNoteIds(inputText, kind as SessionKind, personId);
    const session = await createSession({
      kind,
      personId,
      inputText,
      goal,
      contextNoteIds,
    });

    const generated = await generateCoachingBundle({
      kind,
      personId,
      inputText,
      goal,
      contextNoteIds,
    });

    const artifact = await attachArtifact(session.id, generated.payload, generated.model);

    return NextResponse.json({ sessionId: session.id, artifactId: artifact.id, payload: artifact.payload });
  } catch {
    return NextResponse.json({ error: "Failed to run coaching" }, { status: 500 });
  }
}
