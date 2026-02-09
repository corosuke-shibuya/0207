import { listNotes, listSessions } from "@/lib/deep-dive/store";
import { SessionKind } from "@/lib/deep-dive/types";

export async function pickContextNoteIds(
  inputText: string,
  kind: SessionKind,
  personId: string,
  limit = 6,
) {
  const tokens = inputText
    .toLowerCase()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 2);

  const notes = await listNotes(80);
  const scored = notes.map((note) => {
    const body = note.body.toLowerCase();
    const score = tokens.reduce((sum, token) => (body.includes(token) ? sum + 1 : sum), 0);
    return { id: note.id, score };
  });

  const byText = scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.id);

  if (byText.length >= Math.min(3, limit)) {
    return byText;
  }

  const personSessions = (await listSessions())
    .filter((session) => session.personId === personId && session.kind === kind)
    .slice(0, 3);

  const fromSession = personSessions.flatMap((session) => session.contextNoteIds);
  return [...new Set([...byText, ...fromSession])].slice(0, limit);
}
