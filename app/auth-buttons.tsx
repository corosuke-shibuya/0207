"use client";

import { signIn, signOut } from "next-auth/react";

type Props = {
  email?: string;
  googleEnabled: boolean;
};

export function AuthButtons({ email, googleEnabled }: Props) {
  if (!googleEnabled) {
    return <span className="dd-muted">Demo mode</span>;
  }

  if (email) {
    return (
      <div className="auth-area">
        <span className="dd-muted">{email}</span>
        <button
          className="ghost-button"
          type="button"
          onClick={() => signOut({ callbackUrl: "/deep-dive" })}
        >
          Logout
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
      Google Login
    </button>
  );
}
