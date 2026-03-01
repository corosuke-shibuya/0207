"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

type PersonOption = {
  id: string;
  name: string;
  role?: string;
};

type SparringData = {
  analysis_summary: string;
  recommendations: string[];
  user_pattern: string;
  coach_feedback: string;
  next_options: string[];
  follow_up_question: string;
  roleplay_reply: string;
  risk_note: string;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  sparringData?: SparringData;
};

type RecentSession = {
  id: string;
  kind: "PRE" | "POST";
  personName: string;
  createdAt: string;
  inputText: string;
};

type SparringMode = "PRE_REFLECT" | "PRE_STRATEGY" | "FACILITATION";

const MODE_OPTIONS: { value: SparringMode; label: string; helper: string }[] = [
  { value: "PRE_REFLECT", label: "A. 事後振り返り", helper: "会話のズレや詰まりを振り返り、次に見るべき論点を深める" },
  { value: "PRE_STRATEGY", label: "B. 事前戦略", helper: "相手に合わせた伝え方・順序・選択肢を作る" },
  { value: "FACILITATION", label: "C. ファシリ支援", helper: "会議の論点整理と進行の詰まりを解消する" },
];

function renderMarkdown(text: string) {
  const paragraphs = text.split(/\n\n+/).filter((paragraph) => paragraph.trim());
  return paragraphs.map((paragraph, i) => {
    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) {
        return (
          <strong key={j} style={{ color: "#1d4ed8" }}>
            {boldMatch[1]}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });

    return (
      <p key={i} style={{ margin: "0 0 12px 0", lineHeight: 1.8 }}>
        {rendered}
      </p>
    );
  });
}

function SparringResponseView({ data }: { data: SparringData }) {
  const isPureText = data.recommendations.length === 0 && data.next_options.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {data.roleplay_reply.trim() && (
        <div
          style={{
            background: "#f0f4ff",
            borderRadius: 12,
            padding: "14px 18px",
            borderLeft: "4px solid #4a7cff",
          }}
        >
          <p style={{ fontSize: "0.85rem", color: "#4a7cff", fontWeight: 700, marginBottom: 6 }}>相手の反応</p>
          <p style={{ margin: 0, lineHeight: 1.7 }}>{data.roleplay_reply}</p>
        </div>
      )}

      {data.coach_feedback.trim() && (
        <div style={{ lineHeight: 1.8 }}>
          {typeof ReactMarkdown !== "undefined" ? (
            <ReactMarkdown
              components={{
                strong: ({ children }) => <strong style={{ color: "#1d4ed8" }}>{children}</strong>,
                p: ({ children }) => <p style={{ margin: "0 0 12px 0" }}>{children}</p>,
                h2: ({ children }) => (
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "16px 0 8px 0", color: "#1e293b" }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "12px 0 6px 0", color: "#334155" }}>{children}</h3>
                ),
                ul: ({ children }) => <ul style={{ margin: "8px 0", paddingLeft: 20 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: "8px 0", paddingLeft: 20 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4, lineHeight: 1.8 }}>{children}</li>,
              }}
            >
              {data.coach_feedback}
            </ReactMarkdown>
          ) : (
            renderMarkdown(data.coach_feedback)
          )}
        </div>
      )}

      {!isPureText && (
        <>
          {data.recommendations.length > 0 && (
            <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "14px 18px" }}>
              <p style={{ fontSize: "0.85rem", color: "#15803d", fontWeight: 700, marginBottom: 8 }}>💡 おすすめアクション</p>
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {data.recommendations.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          )}

          {data.next_options.length > 0 && (
            <div style={{ background: "#f7f8fa", borderRadius: 12, padding: "14px 18px" }}>
              <p style={{ fontSize: "0.85rem", color: "#5a667b", fontWeight: 700, marginBottom: 8 }}>🗣️ こんな切り出し方があります</p>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {data.next_options.map((option, i) => (
                  <li key={i} style={{ color: "#374151" }}>
                    {option}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {data.follow_up_question.trim() && (
        <div
          style={{
            background: "#fffbeb",
            borderRadius: 12,
            padding: "14px 18px",
            borderLeft: "4px solid #f59e0b",
          }}
        >
          <p style={{ margin: 0, lineHeight: 1.7 }}>{data.follow_up_question}</p>
        </div>
      )}
    </div>
  );
}

export function SparringClient({
  people,
  recentSessions,
  hasUserProfile,
  initialPersonId,
  initialScenario,
  initialMode,
}: {
  people: PersonOption[];
  recentSessions: RecentSession[];
  hasUserProfile: boolean;
  initialPersonId?: string;
  initialScenario?: string;
  initialMode?: SparringMode;
}) {
  const [personId, setPersonId] = useState(initialPersonId ?? "");
  const [mode, setMode] = useState<SparringMode>(initialMode ?? "PRE_STRATEGY");
  const [scenario, setScenario] = useState(initialScenario ?? "");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStarted = useMemo(() => history.some((turn) => turn.role === "assistant"), [history]);
  const canStart = useMemo(() => Boolean(scenario.trim().length >= 8 && !loading), [scenario, loading]);
  const canSend = useMemo(() => Boolean(hasStarted && input.trim().length > 0 && !loading), [hasStarted, input, loading]);

  function buildAssistantTurn(data: any): ChatTurn {
    const sparringData: SparringData | undefined = data.analysis_summary
      ? {
          analysis_summary: data.analysis_summary ?? "",
          recommendations: data.recommendations ?? [],
          user_pattern: data.user_pattern ?? "",
          coach_feedback: data.coach_feedback ?? "",
          next_options: data.next_options ?? [],
          follow_up_question: data.follow_up_question ?? "",
          roleplay_reply: data.roleplay_reply ?? "",
          risk_note: data.risk_note ?? "",
        }
      : undefined;

    const assistantText = typeof data.assistant_text === "string" ? data.assistant_text : data.analysis_summary ?? "回答を生成できませんでした。";
    return { role: "assistant", content: assistantText, sparringData };
  }

  async function startSparring() {
    const activeScenario = scenario.trim();
    if (!activeScenario) {
      return;
    }

    setLoading(true);
    setError(null);
    setHistory([]);
    setSessionId(null);
    setInput("");

    try {
      const response = await fetch("/api/deep-dive/sparring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: null,
          personId,
          mode,
          scenario: activeScenario,
          history: [],
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

      setHistory([{ role: "user", content: activeScenario }, buildAssistantTurn(data)]);
      setLoading(false);
    } catch {
      setError("壁打ち生成に失敗しました");
      setLoading(false);
    }
  }

  async function sendTurn() {
    const userMessage = input.trim();
    if (!userMessage) {
      return;
    }

    setLoading(true);
    setError(null);

    const nextHistory: ChatTurn[] = [...history, { role: "user", content: userMessage }];
    setHistory(nextHistory);
    setInput("");

    try {
      const response = await fetch("/api/deep-dive/sparring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          personId,
          mode,
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

      setHistory([...nextHistory, buildAssistantTurn(data)]);
      setLoading(false);
    } catch {
      setError("壁打ち生成に失敗しました");
      setLoading(false);
    }
  }

  function resetSparring() {
    setHistory([]);
    setSessionId(null);
    setInput("");
    setError(null);
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

      {!hasUserProfile && (
        <div
          style={{
            background: "#fffbeb",
            borderRadius: 12,
            padding: "12px 18px",
            borderLeft: "4px solid #f59e0b",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            💡 あなたの特性を登録すると、より的確なアドバイスが受けられます。
            <Link href="/deep-dive/profile" style={{ color: "#4a7cff", marginLeft: 8 }}>
              登録する →
            </Link>
          </p>
        </div>
      )}

      <article className="card">
        <div className="input-area" style={{ marginBottom: 14, gap: 8 }}>
          <span>相談モード</span>
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              style={{
                display: "grid",
                gridTemplateColumns: "20px auto 1fr",
                alignItems: "center",
                columnGap: 10,
                rowGap: 2,
                opacity: option.value === "FACILITATION" ? 0.45 : 1,
              }}
            >
              <input
                type="radio"
                name="sparring-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={(event) => setMode(event.target.value as SparringMode)}
                disabled={option.value === "FACILITATION"}
              />
              <span style={{ fontWeight: 700 }}>{option.label}</span>
              <span style={{ color: "#5a667b", fontSize: "0.96rem", lineHeight: 1.4 }}>{option.helper}</span>
            </label>
          ))}
        </div>

        <div className="grid-2">
          <label className="input-area" style={{ gap: 6 }}>
            <span>相談対象</span>
            <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
              <option value="">なし（未登録）</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} {person.role ? `(${person.role})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <article className="card">
        {hasStarted ? (
          <div className="chat-window">
            {history.map((turn, index) => (
              <div key={index} className={turn.role === "assistant" ? "dd-turn-ai" : "dd-turn-user"}>
                {turn.role === "assistant" && turn.sparringData ? (
                  <SparringResponseView data={turn.sparringData} />
                ) : (
                  <p className="dd-message-text">{turn.content}</p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="input-area" style={{ marginTop: hasStarted ? 14 : 0 }}>
          <span>{hasStarted ? "返信する" : "状況"}</span>
          {!hasStarted ? (
            <small style={{ color: "#5a667b", fontSize: "0.96rem", lineHeight: 1.45 }}>
              相談でクリアにしたいこと(相談のゴール)を入力するとより回答精度が上がります（例: 責任論に入らず合意形成したい）
            </small>
          ) : null}
          <textarea
            value={hasStarted ? input : scenario}
            onChange={(event) => (hasStarted ? setInput(event.target.value) : setScenario(event.target.value))}
            placeholder={hasStarted ? "追加で伝えたいことを書く" : "いま困っている状況を短く書いてください"}
          />
          <div className="button-row">
            <button className="primary-button" type="button" disabled={hasStarted ? !canSend : !canStart} onClick={hasStarted ? sendTurn : startSparring}>
              {loading ? (hasStarted ? "返信生成中..." : "相談開始中...") : hasStarted ? "返信する" : "AIに相談を開始"}
            </button>
            {hasStarted ? (
              <button className="secondary-button" type="button" disabled={loading} onClick={resetSparring}>
                改めてやり直す
              </button>
            ) : null}
          </div>
          {error ? <p className="muted">{error}</p> : null}
        </div>
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
