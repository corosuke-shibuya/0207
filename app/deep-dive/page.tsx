import Link from "next/link";
import { listPeople, listSessions } from "@/lib/deep-dive/store";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function getAuthErrorMessage(error?: string) {
  if (!error) {
    return null;
  }
  if (error === "google") {
    return "Googleログインに失敗しました。OAuth同意画面のテストユーザー設定とリダイレクトURIを確認してください。";
  }
  if (error === "AccessDenied") {
    return "アクセスが拒否されました。Google OAuthのテストユーザーに現在のアカウントを追加してください。";
  }
  return `ログインに失敗しました（${error}）。`;
}

export default async function DeepDiveHomePage({ searchParams }: Props) {
  const params = await searchParams;
  const authErrorMessage = getAuthErrorMessage(params.error);
  const people = await listPeople();
  const sessions = (await listSessions()).slice(0, 5);

  return (
    <div className="grid-2">
      {authErrorMessage ? (
        <article className="card" style={{ gridColumn: "1 / -1", border: "1px solid #f2c9c9", background: "#fff4f4" }}>
          <p className="section-title">ログインエラー</p>
          <p className="dd-muted">{authErrorMessage}</p>
        </article>
      ) : null}

      <article className="card">
        <p className="section-title">MVP導線</p>
        <div className="timeline">
          <p>1. Timelineに短文ログを書く（600字目安）</p>
          <p>2. Peopleで相手タイプを登録</p>
          <p>3. Coachで事前/事後相談を実行</p>
          <p>4. Detailで次回の学びを確認</p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Link className="primary-button" href="/deep-dive/coach">
            相談をはじめる
          </Link>
          <Link className="secondary-button" href="/deep-dive/people">
            相手を追加
          </Link>
        </div>
      </article>

      <article className="card">
        <p className="section-title">最近の相談</p>
        {sessions.length === 0 ? (
          <p className="dd-muted">まだ相談履歴がありません。</p>
        ) : (
          <div className="timeline">
            {sessions.map((session) => {
              const person = people.find((row) => row.id === session.personId);
              return (
                <Link key={session.id} href={`/deep-dive/sessions/${session.id}`} className="chat-bubble">
                  <strong>{session.kind === "PRE" ? "事前相談" : "事後振り返り"}</strong>
                  <p>{person?.name ?? "相手未設定"}</p>
                  <p className="dd-muted">{session.inputText.slice(0, 100)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
}
