import { createNoteAction } from "@/app/deep-dive/actions";
import { listNotes } from "@/lib/deep-dive/store";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const notes = await listNotes();

  return (
    <div className="grid-2">
      <article className="card">
        <p className="section-title">ログを書く</p>
        <form action={createNoteAction} className="input-area">
          <textarea
            name="body"
            maxLength={600}
            placeholder="今日の会話メモを短く書く（例: 結論を先に言えず、相手が急いでいた）"
            required
          />
          <button type="submit" className="primary-button">
            保存
          </button>
        </form>
        <p className="dd-muted">約600字が気持ちよい設計。曖昧なメモでも次回の助言に使います。</p>
      </article>

      <article className="card">
        <p className="section-title">Timeline</p>
        <div className="timeline">
          {notes.length === 0 ? (
            <p className="dd-muted">まだログがありません。</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="chat-bubble">
                <p>{note.body}</p>
                <p className="dd-muted">{new Date(note.createdAt).toLocaleString("ja-JP")}</p>
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  );
}
