"use client";

import { signIn, signOut } from "next-auth/react";

type Props = {
  email?: string;
  googleEnabled: boolean;
};

export function AuthButtons({ email, googleEnabled }: Props) {
  if (!googleEnabled) {
    return <span className="auth-status">Demo mode</span>;
  }

  if (email) {
    return (
      <div className="auth-area">
        <span className="auth-status">{email}</span>
        <button
          className="ghost-button"
          type="button"
          onClick={() => signOut({ callbackUrl: "/deep-dive" })}
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <button
      className="ghost-button"
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/deep-dive" })}
    >
      Googleログイン
    </button>
  );
}
