import { NextResponse } from "next/server";
import { adoptDraftForSession } from "@/lib/deep-dive/store";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tone = typeof body?.tone === "string" ? body.tone.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!id || !tone || !message) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const payload = await adoptDraftForSession(id, tone, message);
    return NextResponse.json({ ok: true, adoptedDraft: payload.adopted_draft });
  } catch {
    return NextResponse.json({ error: "Failed to adopt draft" }, { status: 500 });
  }
}
