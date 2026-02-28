import { listNotes } from "@/lib/deep-dive/store";

function calcScore(total: number) {
  if (total >= 10) return 88;
  if (total >= 6) return 78;
  if (total >= 3) return 67;
  return 52;
}

export default async function ReportPage() {
  const notes = await listNotes(30);
  const score = calcScore(notes.length);
  const now = new Date();

  return (
    <section className="screen">
      <div className="page-heading">
        <div>
          <h1>あなたの分析レポート</h1>
          <p>
            直近{Math.min(notes.length, 30)}件の記録を分析
          </p>
        </div>
        <p>
          生成日<br />
          <strong>{now.toLocaleDateString("ja-JP")}</strong>
        </p>
      </div>

      <article className="feature-banner">
        <h2>📊 分析サマリー</h2>
        <p>最近の記録から、あなたのコミュニケーション傾向を自動で要約しています。</p>
      </article>

      <article className="card">
        <p className="section-title">✨ あなたの強み</p>
        <div className="skill-row">
          <div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: 8 }}>論理的な説明力</h3>
            <p className="muted">背景と結論を整理して伝える傾向があります。</p>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${score}%` }} />
            </div>
            <p style={{ textAlign: "right", fontWeight: 800, color: "#1d4ed8" }}>{score}%</p>
          </div>
        </div>
      </article>

      <article style={{ display: "flex", justifyContent: "center" }}>
        <a href="/deep-dive/coach" className="primary-button" style={{ minWidth: 360, textAlign: "center" }}>
          💬 このレポートについてAIに相談する
        </a>
      </article>
    </section>
  );
}
