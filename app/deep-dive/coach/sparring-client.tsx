"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PersonOption = {
  id: string;
  name: string;
  role?: string;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
};

type RecentSession = {
  id: string;
  kind: "PRE" | "POST";
  personName: string;
  createdAt: string;
  inputText: string;
};

type SparringMode = "PRE_REFLECT" | "PRE_STRATEGY" | "FACILITATION";

const QUICK_SUGGESTIONS = [
  "明日の上司とのミーティング、どう準備したらいい?",
  "メンバーをイライラさせてしまった原因は?",
];

const MODE_OPTIONS: { value: SparringMode; label: string; helper: string }[] = [
  { value: "PRE_REFLECT", label: "A. 事前振り返り", helper: "直近のズレ要因を整理して、次で直す点を絞る" },
  { value: "PRE_STRATEGY", label: "B. 事前戦略", helper: "相手に合わせた伝え方・順序・選択肢を作る" },
  { value: "FACILITATION", label: "C. ファシリ支援", helper: "会議の論点整理と進行の詰まりを解消する" },
];

export function SparringClient({
  people,
  recentSessions,
}: {
  people: PersonOption[];
  recentSessions: RecentSession[];
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [mode, setMode] = useState<SparringMode>("PRE_STRATEGY");
  const [goal, setGoal] = useState("");
  const [scenario, setScenario] = useState("");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart = useMemo(() => Boolean(personId && scenario.trim().length >= 8 && !loading), [personId, scenario, loading]);
  const canSend = useMemo(
    () => Boolean(history.some((turn) => turn.role === "assistant") && input.trim().length > 0 && !loading),
    [history, input, loading],
  );

  async function sendTurn(nextUserMessage?: string, options?: { hideUser?: boolean }) {
    const userMessage = (nextUserMessage ?? input).trim();
    if (!userMessage) {
      return;
    }

    setLoading(true);
    setError(null);

    const nextHistory: ChatTurn[] = [
      ...history,
      { role: "user", content: userMessage, hidden: options?.hideUser ?? false },
    ];
    setHistory(nextHistory);
    setInput("");

    const response = await fetch("/api/deep-dive/sparring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        personId,
        mode,
        goal,
        scenario,
        history: nextHistory.map((turn) => ({ role: turn.role, content: turn.content })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error ?? "壁打ち生成に失敗しました");
      setLoading(false);
      return;
    }

    if (typeof data.sessionId === "string") {
      setSessionId(data.sessionId);
    }

    const assistantText = `相手役: ${data.roleplay_reply}\n\nコーチ: ${data.coach_feedback}`;
    setHistory([...nextHistory, { role: "assistant", content: assistantText }]);
    setLoading(false);
  }

  async function startSparring(prefill?: string) {
    if (prefill && !scenario.trim()) {
      setScenario(prefill);
    }
    const bootPromptMap: Record<SparringMode, string> = {
      PRE_REFLECT: "この状況で自分の改善ポイントを先に分析し、次回の改善行動を具体化してください。",
      PRE_STRATEGY: "この状況で相手タイプに合わせた事前戦略を作ってください。一般論ではなく私の文脈でお願いします。",
      FACILITATION: "この状況で議論を前進させるためのファシリ支援をしてください。論点整理からお願いします。",
    };
    const bootPrompt = bootPromptMap[mode];
    setHistory([]);
    setSessionId(null);
    await sendTurn(bootPrompt, { hideUser: true });
  }

  if (people.length === 0) {
    return (
      <section className="screen">
        <article className="card">
          <p className="section-title">AI相談</p>
          <p className="muted" style={{ marginBottom: 14 }}>
            先に相手を1人登録すると、タイプに合わせた壁打ちができます。
          </p>
          <Link href="/deep-dive/people" className="primary-button" style={{ display: "inline-block" }}>
            相手を登録する
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="page-heading" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="avatar-circle" style={{ width: 96, height: 96, fontSize: "2.4rem" }}>
            🐶
          </div>
          <div>
            <h1>AIコミュニケーション相談</h1>
            <p>あなたの文脈をふまえて、具体的なアドバイスを返します</p>
          </div>
        </div>
      </div>

      <article className="card">
        <p className="section-title" style={{ fontSize: "1.5rem" }}>よくある相談</p>
        <div className="suggestion-grid" style={{ marginBottom: 14 }}>
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestion"
              onClick={async () => {
                setScenario(suggestion);
                setInput("");
                await startSparring(suggestion);
              }}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <label className="input-area" style={{ gap: 6 }}>
            <span>相談モード</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as SparringMode)}>
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="muted">{MODE_OPTIONS.find((option) => option.value === mode)?.helper}</small>
          </label>
          <label className="input-area" style={{ gap: 6 }}>
            <span>相談する相手</span>
            <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} {person.role ? `(${person.role})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="input-area" style={{ gap: 6 }}>
            <span>ゴール（任意）</span>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="例: 相手と合意できる選択肢を作る" />
          </label>
        </div>

        <label className="input-area" style={{ marginTop: 12, gap: 6 }}>
          <span>状況</span>
          <textarea
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            placeholder="いま困っている状況を短く書いてください"
          />
        </label>

        <div className="button-row" style={{ marginTop: 12 }}>
          <button className="primary-button" type="button" onClick={() => startSparring()} disabled={!canStart}>
            {loading ? "相談開始中..." : "AIに相談を開始"}
          </button>
          {sessionId ? (
            <Link href={`/deep-dive/sessions/${sessionId}`} className="secondary-button">
              この相談をDetailで見る
            </Link>
          ) : null}
        </div>
        {error ? <p className="muted" style={{ marginTop: 8 }}>{error}</p> : null}
      </article>

      <article className="card">
        <div className="chat-window">
          {history.filter((turn) => !turn.hidden).length === 0 ? (
            <div className="dd-turn-ai">
              <p className="dd-message-text">こんにちは! コミュニケーションのこと、何が相談したいですか?</p>
            </div>
          ) : (
            history
              .filter((turn) => !turn.hidden)
              .map((turn, index) => (
                <div key={index} className={turn.role === "assistant" ? "dd-turn-ai" : "dd-turn-user"}>
                  <p className="dd-message-text">{turn.content}</p>
                </div>
              ))
          )}
        </div>

        {history.some((turn) => turn.role === "assistant") ? (
          <div className="input-area" style={{ marginTop: 14 }}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="追加で伝えたいことを書く"
            />
            <button className="primary-button" type="button" disabled={!canSend} onClick={() => sendTurn()}>
              {loading ? "返信生成中..." : "返信する"}
            </button>
          </div>
        ) : null}
      </article>

      <article className="card">
        <p className="section-title" style={{ fontSize: "1.4rem" }}>最近の相談</p>
        <div className="timeline">
          {recentSessions.length === 0 ? (
            <p className="muted">まだ相談履歴がありません。</p>
          ) : (
            recentSessions.slice(0, 5).map((item) => (
              <Link key={item.id} href={`/deep-dive/sessions/${item.id}`} className="chat-bubble">
                <strong>{item.personName}</strong>
                <p className="muted">{new Date(item.createdAt).toLocaleString("ja-JP")}</p>
                <p>{item.inputText.slice(0, 90)}</p>
              </Link>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
