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

export function SparringClient({
  people,
  recentSessions,
}: {
  people: PersonOption[];
  recentSessions: RecentSession[];
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [goal, setGoal] = useState("");
  const [scenario, setScenario] = useState("");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(
    () => Boolean(history.some((turn) => turn.role === "assistant") && input.trim().length > 0 && !loading),
    [history, input, loading],
  );

  const canStart = useMemo(
    () => Boolean(personId && scenario.trim().length >= 12 && !loading),
    [personId, scenario, loading],
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

  async function startSparring() {
    const bootPrompt = [
      "この状況について、まず最初に私へフィードバックしてください。",
      "次に、相手が返してきそうな反応と私の改善ポイントを簡潔にください。",
    ].join(" ");
    setHistory([]);
    setSessionId(null);
    await sendTurn(bootPrompt, { hideUser: true });
  }

  return (
    <div className="grid-2">
      <article className="card">
        <p className="section-title">壁打ち設定</p>
        <div className="input-area">
          <label>
            相手
            <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
              <option value="">選択してください</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} {person.role ? `(${person.role})` : ""}
                </option>
              ))}
            </select>
          </label>
          <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="ゴール（例: 部長とリスク認識を握る）" />
          <textarea
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            placeholder="状況（背景・制約・懸念）"
          />
          <button className="primary-button" type="button" disabled={!canStart} onClick={startSparring}>
            {loading ? "壁打ち開始中..." : "左の設定で開始"}
          </button>
        </div>
        {sessionId ? (
          <div className="dd-inline-actions" style={{ marginTop: 12 }}>
            <Link href={`/deep-dive/sessions/${sessionId}`} className="secondary-button">
              この壁打ちをDetailで見る
            </Link>
          </div>
        ) : null}
        <div style={{ marginTop: 14 }}>
          <p className="section-title">壁打ち履歴</p>
          {recentSessions.length === 0 ? (
            <p className="dd-muted">まだ履歴がありません。</p>
          ) : (
            <div className="timeline">
              {recentSessions.slice(0, 8).map((item) => (
                <Link key={item.id} href={`/deep-dive/sessions/${item.id}`} className="chat-bubble">
                  <strong>{item.kind === "PRE" ? "事前相談" : "事後振り返り"}</strong>
                  <p>{item.personName}</p>
                  <p className="dd-muted">{new Date(item.createdAt).toLocaleString("ja-JP")}</p>
                  <p className="dd-muted">{item.inputText.slice(0, 60)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </article>

      <article className="card">
        <p className="section-title">AI壁打ち / Detail</p>
        <div className="timeline dd-list" style={{ marginBottom: 10 }}>
          <p>相手: {people.find((person) => person.id === personId)?.name ?? "未選択"}</p>
          <p>ゴール: {goal || "未設定"}</p>
        </div>
        <div className="timeline dd-chat-log">
          {history.filter((turn) => !turn.hidden).length === 0 ? (
            <p className="dd-muted">左の設定を入力して開始ボタンを押すと、AIが先に返答します。</p>
          ) : (
            history.filter((turn) => !turn.hidden).map((turn, index) => (
              <div key={index} className={turn.role === "user" ? "dd-turn-user" : "dd-turn-ai"}>
                <p className="dd-muted">{turn.role === "user" ? "あなた" : "AI"}</p>
                <pre className="dd-message-text">{turn.content}</pre>
              </div>
            ))
          )}
        </div>

        {history.some((turn) => turn.role === "assistant") ? (
          <div className="input-area" style={{ marginTop: 12 }}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="次に自分が言う一言を書く"
            />
            <button className="primary-button" type="button" disabled={!canSend} onClick={() => sendTurn()}>
              {loading ? "壁打ち中..." : "返信する"}
            </button>
            {error ? <p>{error}</p> : null}
          </div>
        ) : (
          error ? <p>{error}</p> : null
        )}
      </article>
    </div>
  );
}
