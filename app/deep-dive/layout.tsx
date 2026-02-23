import { getServerSessionSafe, isGoogleAuthEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DeepDiveLayout({ children }: { children: React.ReactNode }) {
  const googleEnabled = isGoogleAuthEnabled();
  const session = await getServerSessionSafe();
  const isAuthenticated = Boolean(session?.user?.email);

  if (googleEnabled && !isAuthenticated) {
    return (
      <section className="dd-shell">
        <article className="card">
          <p className="section-title">ログインが必要です</p>
          <p className="dd-muted">
            Googleアカウントでログインすると、あなたのデータのみ表示されます。ログアウト中はデータを表示しません。
          </p>
        </article>
      </section>
    );
  }

  return <section className="dd-shell">{children}</section>;
}
