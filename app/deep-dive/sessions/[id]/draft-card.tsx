"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sessionId: string;
  tone: string;
  initialMessage: string;
  whyItWorks: string;
  risks: string;
  isInitiallyAdopted?: boolean;
};

type RewriteTone = "short" | "polite" | "direct";

export function DraftCard({
  sessionId,
  tone,
  initialMessage,
  whyItWorks,
  risks,
  isInitiallyAdopted = false,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<RewriteTone | null>(null);
  const [adopted, setAdopted] = useState(isInitiallyAdopted);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus("コピーしました");
      setTimeout(() => setStatus(null), 1200);
    } catch {
      setStatus("コピーに失敗しました");
    }
  }

  async function rewrite(toneType: RewriteTone) {
    setLoading(toneType);
    setStatus(null);
    try {
      const response = await fetch("/api/deep-dive/drafts/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, tone: toneType }),
      });

      const data = await response.json();
      if (!response.ok || !data?.message) {
        setStatus(data?.error ?? "再生成に失敗しました");
        return;
      }

      setMessage(String(data.message));
      setStatus("再生成しました");
    } catch {
      setStatus("再生成に失敗しました");
    } finally {
      setLoading(null);
      setTimeout(() => setStatus(null), 1600);
    }
  }

  async function adoptDraft() {
    setStatus(null);
    const response = await fetch(`/api/deep-dive/sessions/${sessionId}/adopt-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone, message }),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) {
      setStatus(data?.error ?? "採用保存に失敗しました");
      return;
    }
    setAdopted(true);
    setStatus("採用しました");
    router.refresh();
  }

  return (
    <div className="chat-bubble">
      <strong>{tone}</strong>
      <div className="dd-message-block">
        <pre className="dd-message-text">{message}</pre>
        <div className="dd-inline-actions">
          <button type="button" className="secondary-button" onClick={copyMessage}>
            文面をコピー
          </button>
          <button type="button" className="primary-button" onClick={adoptDraft}>
            {adopted ? "採用済み" : "この案を採用"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={Boolean(loading)}
            onClick={() => rewrite("short")}
          >
            {loading === "short" ? "再生成中..." : "短く"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={Boolean(loading)}
            onClick={() => rewrite("polite")}
          >
            {loading === "polite" ? "再生成中..." : "ていねい"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={Boolean(loading)}
            onClick={() => rewrite("direct")}
          >
            {loading === "direct" ? "再生成中..." : "率直"}
          </button>
        </div>
        {status ? <p className="dd-muted">{status}</p> : null}
      </div>
      <p className="dd-muted">なぜ効く: {whyItWorks}</p>
      <p className="dd-muted">リスク: {risks}</p>
    </div>
  );
}
