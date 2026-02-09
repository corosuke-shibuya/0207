"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
  tone: string;
  message: string;
};

export function AdoptedDraftPanel({ sessionId, tone, message }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveToTimeline() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/deep-dive/sessions/${sessionId}/save-adopted-note`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setStatus(data?.error ?? "保存に失敗しました");
        return;
      }
      setStatus("Timelineに保存しました");
    } catch {
      setStatus("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dd-adopted">
      <p className="section-title" style={{ marginBottom: 8 }}>
        採用中の文面
      </p>
      <p className="dd-muted">トーン: {tone}</p>
      <pre className="dd-message-text">{message}</pre>
      <button type="button" className="secondary-button" disabled={saving} onClick={saveToTimeline}>
        {saving ? "保存中..." : "Timelineに保存"}
      </button>
      {status ? <p className="dd-muted">{status}</p> : null}
    </div>
  );
}
