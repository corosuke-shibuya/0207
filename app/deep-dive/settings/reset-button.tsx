"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleReset() {
    const confirmed = window.confirm("全データを削除します。元に戻せません。実行しますか？");
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/deep-dive/reset", { method: "POST" });
    if (!response.ok) {
      setError("削除に失敗しました");
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/deep-dive");
  }

  return (
    <div className="input-area" style={{ marginTop: 12 }}>
      <button type="button" className="secondary-button" disabled={loading} onClick={handleReset}>
        {loading ? "削除中..." : "全削除"}
      </button>
      {error ? <p>{error}</p> : null}
    </div>
  );
}
