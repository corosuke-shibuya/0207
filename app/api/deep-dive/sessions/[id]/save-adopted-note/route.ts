import { NextResponse } from "next/server";
import { createNote, getSessionDetail } from "@/lib/deep-dive/store";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Props) {
  try {
    const { id } = await params;
    const detail = await getSessionDetail(id);
    if (!detail?.artifact?.payload.adopted_draft?.message) {
      return NextResponse.json({ error: "Adopted draft not found" }, { status: 404 });
    }

    const adopted = detail.artifact.payload.adopted_draft;
    const noteBody = [
      `【送信メモ / ${detail.person?.name ?? "相手未設定"} / ${adopted.tone}】`,
      adopted.message,
    ].join("\n");

    const created = await createNote(noteBody, []);

    return NextResponse.json({ ok: true, noteId: created.id });
  } catch {
    return NextResponse.json({ error: "Failed to save adopted draft" }, { status: 500 });
  }
}
