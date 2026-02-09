import type { Metadata } from "next";
import { Sora, Newsreader } from "next/font/google";
import { AuthButtons } from "@/app/auth-buttons";
import { getServerSessionSafe, isGoogleAuthEnabled } from "@/lib/auth";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Deep Dive | Communication Coach",
  description: "People-aware communication coaching for daily situations.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSessionSafe();
  const googleEnabled = isGoogleAuthEnabled();

  return (
    <html lang="ja">
      <body suppressHydrationWarning className={`${sora.variable} ${newsreader.variable}`}>
        <div className="app-shell">
          <header className="app-header">
            <div className="brand">
              <div className="brand-mark">K</div>
              <div>
                <p className="brand-title">Deep Dive</p>
                <p className="brand-subtitle">Communication Coach</p>
              </div>
            </div>
            <nav className="app-nav">
              <a href="/deep-dive">Home</a>
              <a href="/deep-dive/timeline">Timeline</a>
              <a href="/deep-dive/people">People</a>
              <a href="/deep-dive/coach">Coach</a>
              <a href="/deep-dive/settings">Settings</a>
            </nav>
            <AuthButtons email={session?.user?.email ?? undefined} googleEnabled={googleEnabled} />
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
