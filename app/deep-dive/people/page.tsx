import { createPersonAction } from "@/app/deep-dive/actions";
import { PERSON_PRESETS } from "@/lib/deep-dive/person-presets";
import { listPeople } from "@/lib/deep-dive/store";

export const dynamic = "force-dynamic";

const priorityLabelMap = {
  politics: "評価・ポジション型",
  logic: "正しさ・論理型",
  risk: "リスク回避型",
  outcome: "成果・数字型",
  speed: "スピード・決断型",
  harmony: "合意・調和型",
} as const;

export default async function PeoplePage() {
  const people = await listPeople();

  return (
    <div className="grid-2">
      <article className="card">
        <p className="section-title">相手を登録</p>
        <p className="dd-muted" style={{ marginBottom: 12 }}>
          迷ったらプリセットを選んで、メモは後で追記でOKです。
        </p>
        <form action={createPersonAction} className="input-area">
          <input name="name" placeholder="名前（必須）" required />
          <input name="role" placeholder="役割（例: PM, 上司, 顧客）" />
          <input name="relationship" placeholder="関係（例: 同僚, 取引先）" />
          <select name="presetId" defaultValue={PERSON_PRESETS[0].id}>
            {PERSON_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} - {preset.description}
              </option>
            ))}
          </select>
          <textarea name="memo" placeholder="メモ（任意）" />
          <button className="primary-button" type="submit">
            追加
          </button>
        </form>
      </article>

      <article className="card">
        <p className="section-title">関係者一覧</p>
        <div className="timeline">
          {people.length === 0 ? (
            <p className="dd-muted">まだ相手が登録されていません。</p>
          ) : (
            people.map((person) => (
              <div key={person.id} className="chat-bubble dd-person-card">
                <div className="dd-person-head">
                  <strong>
                    {person.name}
                    {person.role ? ` (${person.role})` : ""}
                  </strong>
                  <span className="dd-pill">{priorityLabelMap[person.typeAxes.priority]}</span>
                </div>
                <p className="dd-muted">{person.relationship || "関係未設定"}</p>
                <div className="dd-axes">
                  <span className="dd-pill">伝え方: {person.typeAxes.directness}</span>
                  <span className="dd-pill">文量: {person.typeAxes.verbosity}</span>
                  <span className="dd-pill">判断: {person.typeAxes.decisionSpeed}</span>
                </div>
                <p>{person.memo || "メモなし"}</p>
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  );
}
