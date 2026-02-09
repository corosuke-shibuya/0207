import { ResetButton } from "@/app/deep-dive/settings/reset-button";
import { exportAllData } from "@/lib/deep-dive/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const exportPreview = JSON.stringify(await exportAllData(), null, 2);

  return (
    <div className="grid-2">
      <article className="card">
        <p className="section-title">データエクスポート</p>
        <p className="dd-muted">JSONをダウンロードできます。</p>
        <a href="/api/deep-dive/export" className="primary-button" style={{ display: "inline-block", marginTop: 12 }}>
          JSONをエクスポート
        </a>
      </article>

      <article className="card">
        <p className="section-title">全削除</p>
        <p className="dd-muted">MVP必須機能。確認後に全データを削除します。</p>
        <ResetButton />
      </article>

      <article className="card" style={{ gridColumn: "1 / -1" }}>
        <p className="section-title">エクスポート内容プレビュー</p>
        <pre className="dd-code">{exportPreview}</pre>
      </article>
    </div>
  );
}
