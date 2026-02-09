import { NextResponse } from "next/server";
import { getSessionDetail, setSparringSummary } from "@/lib/deep-dive/store";
import { generateSparringSummary } from "@/lib/deep-dive/sparring-summary";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Props) {
  try {
    const { id } = await params;
    const detail = await getSessionDetail(id);
    if (!detail?.artifact?.payload.sparring) {
      return NextResponse.json({ error: "Sparring session not found" }, { status: 404 });
    }

    const sparring = detail.artifact.payload.sparring;
    const summary = await generateSparringSummary({
      goal: sparring.goal,
      scenario: sparring.scenario,
      turns: sparring.turns,
    });

    const saved = await setSparringSummary(id, summary);
    return NextResponse.json({ ok: true, summary: saved });
  } catch {
    return NextResponse.json({ error: "Failed to close sparring session" }, { status: 500 });
  }
}
