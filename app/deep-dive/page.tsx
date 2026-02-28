import { createNoteAction } from "@/app/deep-dive/actions";
import { HomeNoteForm } from "@/app/deep-dive/home-note-form";
import { getServerSessionSafe } from "@/lib/auth";
import { listNotes } from "@/lib/deep-dive/store";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

function getAuthErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "google") return "Googleログインに失敗しました。Google CloudのOAuth設定を確認してください。";
  if (error === "AccessDenied") return "このGoogleアカウントはテストユーザー未登録の可能性があります。";
  return `ログインエラー: ${error}`;
}

export default async function DeepDiveHomePage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await getServerSessionSafe();
  const authError = getAuthErrorMessage(params.error);
  const notes = await listNotes(8);
  const showAuthError = Boolean(authError && !session?.user?.email);

  return (
    <section className="screen">
      <div className="page-heading">
        <div>
          <h1>おかえりなさい!</h1>
          <p>うまくいかなかった会話を、未整理のまま記録しましょう</p>
        </div>
      </div>

      {showAuthError ? (
        <article className="card" style={{ borderColor: "#f3b7b7", background: "#fff3f3" }}>
          <p className="section-title" style={{ fontSize: "1.3rem" }}>ログインエラー</p>
          <p className="muted">{authError}</p>
        </article>
      ) : null}

      <article className="card composer">
        <div className="avatar-circle">🐶</div>
        <HomeNoteForm action={createNoteAction} />
      </article>

      <article className="card">
        <p className="section-title">最近の記録</p>
        <div className="timeline">
          {notes.length === 0 ? (
            <p className="muted">まだ記録がありません。</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="chat-bubble">
                <p className="muted">{new Date(note.createdAt).toLocaleDateString("ja-JP")}</p>
                <p>{note.body}</p>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
