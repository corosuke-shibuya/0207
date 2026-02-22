"use client";

import { useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

export function HomeNoteForm({ action }: Props) {
  const [value, setValue] = useState("");

  return (
    <form action={action} className="input-area">
      <p className="muted">
        うまくいかなかった出来事だけでOKです。改善案は書かなくて大丈夫。
      </p>
      <textarea
        name="body"
        maxLength={600}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="何が起きたか・相手の反応・何がわからないかを書いてください（例: 部長に遮られた。どこを先に言えばよかったかわからない）"
        required
      />
      <div className="form-foot">
        <p className="muted">{value.length} / 600</p>
        <div className="button-row">
          <button type="button" className="secondary-button" disabled>
            🎤 音声入力
          </button>
          <button type="submit" className="primary-button">
            記録する
          </button>
        </div>
      </div>
    </form>
  );
}
