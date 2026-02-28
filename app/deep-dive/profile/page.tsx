import Link from "next/link";
import { upsertUserProfileAction } from "@/app/deep-dive/actions";
import { getUserProfile } from "@/lib/deep-dive/store";
import type { UserProfile } from "@/lib/deep-dive/types";

const PROFILE_QUESTIONS = [
  {
    key: "priority",
    question: "仕事で大事にしていることは？",
    options: [
      { value: "logic", label: "正しさ・論理の一貫性" },
      { value: "outcome", label: "成果・スピード" },
      { value: "harmony", label: "周囲との調和・関係維持" },
      { value: "risk", label: "リスク回避・安全策" },
      { value: "politics", label: "見え方・評価・政治的配慮" },
      { value: "speed", label: "即断即決・まず進める" },
    ],
  },
  {
    key: "directness",
    question: "伝え方の傾向は？",
    options: [
      { value: "direct", label: "結論からストレートに言う" },
      { value: "indirect", label: "前置きや配慮を入れてから言う" },
    ],
  },
  {
    key: "verbosity",
    question: "説明するとき、どうなりがち？",
    options: [
      { value: "short", label: "短く要点だけ伝える" },
      { value: "long", label: "背景や理由も丁寧に説明する" },
    ],
  },
  {
    key: "emphasis",
    question: "相手を動かすとき、重視するのは？",
    options: [
      { value: "logical", label: "根拠やデータで納得させる" },
      { value: "emotional", label: "気持ちや関係性に配慮する" },
    ],
  },
  {
    key: "stance",
    question: "意見が合わないとき、どうする？",
    options: [
      { value: "defensive", label: "自分の意見を主張する" },
      { value: "cooperative", label: "まず相手に合わせて調整する" },
    ],
  },
  {
    key: "decisionSpeed",
    question: "判断のスピードは？",
    options: [
      { value: "fast", label: "早く決めたい" },
      { value: "slow", label: "じっくり確認してから決めたい" },
    ],
  },
] as const;

type Props = {
  searchParams: Promise<{ edit?: string; saved?: string }>;
};

function labelFor(questionKey: string, value: string) {
  const question = PROFILE_QUESTIONS.find((item) => item.key === questionKey);
  return question?.options.find((option) => option.value === value)?.label ?? value;
}

function buildCommunicationTraits(profile: UserProfile) {
  const { typeAxes, memo, name } = profile;

  const opening = {
    logic: `${name}さんは、話の筋と整合性をかなり重視するタイプです。`,
    outcome: `${name}さんは、成果と前進速度を優先して判断しやすいタイプです。`,
    harmony: `${name}さんは、場の空気や相手との関係維持を重視するタイプです。`,
    risk: `${name}さんは、失敗や抜け漏れを避けるために慎重に考えるタイプです。`,
    politics: `${name}さんは、発言の中身だけでなく見え方や評価のされ方も意識しやすいタイプです。`,
    speed: `${name}さんは、まず決めて進めることを重視するタイプです。`,
  }[typeAxes.priority];

  const delivery = `${
    typeAxes.directness === "direct"
      ? "伝え方は比較的ストレートで、結論を先に置きやすい一方、"
      : "伝え方は配慮を入れる寄りで、相手への当たりは柔らかい一方、"
  }${
    typeAxes.verbosity === "long"
      ? "背景や理由まで丁寧に説明する傾向があります。"
      : "要点を短くまとめる傾向があります。"
  }`;

  const persuasion = `${
    typeAxes.emphasis === "logical"
      ? "相手を動かすときは根拠や筋の通り方を重視しやすく、感情面の納得を後回しにしやすいです。"
      : "相手を動かすときは感情や関係性への配慮を重視しやすく、論点のシャープさが弱まる場面があります。"
  }`;

  const tension = `${
    typeAxes.stance === "defensive"
      ? "意見が食い違う場面では自分の見立てを守りやすいので、正しさはあっても相手に押し返された印象を残すことがあります。"
      : "意見が食い違う場面ではまず相手に合わせて調整しやすいので、自分の論点を引っ込めすぎない意識が必要です。"
  } ${
    typeAxes.decisionSpeed === "fast"
      ? "判断は早めなので、結論を急ぐぶん相手の理解が追いつく前に進めてしまう場面に注意が必要です。"
      : "判断は慎重なので、精度は出しやすい一方でタイミングを逃さない工夫が必要です。"
  }`;

  const note = memo?.trim()
    ? `補足メモを見ると、${memo.trim()}`
    : "";

  return [opening, delivery, persuasion, tension, note].filter(Boolean).join(" ");
}

export default async function ProfilePage({ searchParams }: Props) {
  const params = await searchParams;
  const profile = await getUserProfile();
  const isEdit = !profile || params.edit === "1";

  if (!isEdit && profile) {
    const traits = buildCommunicationTraits(profile);

    return (
      <article className="card">
        <p className="section-title">あなたの特性プロフィール</p>
        <p className="dd-muted" style={{ marginBottom: 16 }}>
          登録内容は1件だけ保存され、保存のたびに上書き更新されます。
        </p>
        {params.saved === "1" ? (
          <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 16px", marginBottom: 16, color: "#166534" }}>
            プロフィールを更新しました。
          </div>
        ) : null}

        <div className="chat-bubble" style={{ marginBottom: 16 }}>
          <strong>あなたのコミュニケーション特徴</strong>
          <p>{traits}</p>
        </div>

        <div className="timeline">
          <div className="chat-bubble">
            <strong>名前</strong>
            <p>{profile.name}</p>
          </div>
          {PROFILE_QUESTIONS.map((item) => (
            <div key={item.key} className="chat-bubble">
              <strong>{item.question}</strong>
              <p>{labelFor(item.key, profile.typeAxes[item.key])}</p>
            </div>
          ))}
          {profile.memo ? (
            <div className="chat-bubble">
              <strong>補足メモ</strong>
              <p>{profile.memo}</p>
            </div>
          ) : null}
        </div>

        <div className="button-row" style={{ marginTop: 16 }}>
          <Link className="primary-button" href="/deep-dive/profile?edit=1">
            編集する
          </Link>
          <Link className="secondary-button" href="/deep-dive/coach">
            AI相談へ戻る
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <p className="section-title">あなたの特性プロフィール</p>
      <p className="dd-muted" style={{ marginBottom: 16 }}>
        回答内容はAI相談の文脈に使われます。あなたの癖に合わせた助言が出やすくなります。
      </p>

      <form action={upsertUserProfileAction} className="input-area">
        <input name="name" placeholder="名前（必須）" required defaultValue={profile?.name ?? ""} />

        {PROFILE_QUESTIONS.map((item) => (
          <fieldset
            key={item.key}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 14px",
              background: "#fff",
            }}
          >
            <legend style={{ fontWeight: 700, padding: "0 6px" }}>{item.question}</legend>
            <div style={{ display: "grid", gap: 8 }}>
              {item.options.map((option) => (
                <label key={option.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    name={item.key}
                    value={option.value}
                    defaultChecked={(profile?.typeAxes?.[item.key] ?? "") === option.value}
                    required
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <textarea
          name="memo"
          placeholder="アンケートでは聞かれなかったが、自分のコミュニケーションで気になっていることや特徴があれば教えてください。（任意）"
          defaultValue={profile?.memo ?? ""}
        />

        <div className="button-row">
          <button className="primary-button" type="submit">
            {profile ? "更新する" : "保存する"}
          </button>
          {profile ? (
            <Link className="secondary-button" href="/deep-dive/profile">
              キャンセル
            </Link>
          ) : null}
        </div>
      </form>
    </article>
  );
}
