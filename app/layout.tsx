import type { Metadata } from "next";
import { AuthButtons } from "@/app/auth-buttons";
import { NavLinks } from "@/app/deep-dive/nav-links";
import { getServerSessionSafe, isGoogleAuthEnabled } from "@/lib/auth";
import "./globals.css";

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
      <body suppressHydrationWarning>
        <header className="app-header">
          <div className="brand">
            <div className="brand-mark">D</div>
            <div>
              <p className="brand-title">DeepDive</p>
            </div>
          </div>
          <div className="header-right">
            <NavLinks />
            <AuthButtons email={session?.user?.email ?? undefined} googleEnabled={googleEnabled} />
          </div>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
