import Link from "next/link";
import { getSessionDetail } from "@/lib/deep-dive/store";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getSessionDetail(id);

  if (!detail) {
    return (
      <article className="card">
        <p className="section-title">セッションが見つかりません</p>
        <Link className="secondary-button" href="/deep-dive/coach">
          Coachへ戻る
        </Link>
      </article>
    );
  }

  const { session, artifact, person, contextNotes } = detail;
  const sparring = artifact?.payload.sparring;

  return (
    <div className="grid-2">
      <article className="card" style={{ gridColumn: "1 / -1" }}>
        <p className="dd-muted">
          {session.kind === "PRE" ? "事前相談" : "事後振り返り"} / {person?.name ?? "相手未設定"}
        </p>
        {sparring ? (
          <>
            <p className="section-title">壁打ちログ</p>
            <div className="timeline dd-chat-log" style={{ marginTop: 10 }}>
              {sparring.turns.map((turn, index) => (
                <div key={`${turn.role}-${index}`} className={turn.role === "user" ? "dd-turn-user" : "dd-turn-ai"}>
                  <p className="dd-muted">{turn.role === "user" ? "あなた" : "AI"}</p>
                  <pre className="dd-message-text">{turn.content}</pre>
                </div>
              ))}
            </div>
            {sparring.analysis_summary ? (
              <div className="chat-bubble" style={{ marginTop: 10 }}>
                <strong>分析結果</strong>
                <p>{sparring.analysis_summary}</p>
              </div>
            ) : null}
            {sparring.user_pattern ? (
              <div className="chat-bubble" style={{ marginTop: 10 }}>
                <strong>あなたのコミュニケーション特徴</strong>
                <p>{sparring.user_pattern}</p>
              </div>
            ) : null}
            {sparring.recommendations && sparring.recommendations.length > 0 ? (
              <div className="chat-bubble" style={{ marginTop: 10 }}>
                <strong>推奨行動（改善案）</strong>
                {sparring.recommendations.map((item, index) => (
                  <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                ))}
              </div>
            ) : null}
            {sparring.follow_up_question ? (
              <p className="dd-muted" style={{ marginTop: 10 }}>
                確認質問: {sparring.follow_up_question}
              </p>
            ) : null}
            <p className="dd-muted">進捗: {sparring.goal_progress ?? "low"}</p>
            <p className="dd-muted" style={{ marginTop: 10 }}>
              注意: {sparring.risk_note ?? "なし"}
            </p>
          </>
        ) : (
          <>
            <p className="section-title">想定反応と返し方</p>
            <div className="timeline">
              {(artifact?.payload.expected_reactions ?? []).map((reaction) => (
                <div key={reaction.reaction} className="chat-bubble">
                  <p>反応: {reaction.reaction}</p>
                  <p className="dd-muted">返し方: {reaction.how_to_respond}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {sparring ? (
          <div className="button-row" style={{ marginTop: 16 }}>
            <Link
              className="secondary-button"
              href={`/deep-dive/coach?personId=${encodeURIComponent(session.personId)}&scenario=${encodeURIComponent(session.inputText)}&mode=${session.kind === "POST" ? "PRE_REFLECT" : "PRE_STRATEGY"}` }
            >
              この相談をやり直す
            </Link>
          </div>
        ) : null}

        <h3 style={{ marginTop: 18 }}>参照ノート</h3>
        <div className="timeline" style={{ marginTop: 10 }}>
          {contextNotes.map((note) => (
            <p key={note.id} className="dd-muted">
              - {note.body}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
