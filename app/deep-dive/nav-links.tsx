"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/deep-dive", label: "ホーム" },
  { href: "/deep-dive/report", label: "分析レポート" },
  { href: "/deep-dive/coach", label: "AI相談" },
  { href: "/deep-dive/settings", label: "設定" },
];

function isActive(pathname: string, href: string) {
  if (href === "/deep-dive") {
    return pathname === "/deep-dive";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="メインナビゲーション">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(pathname, link.href) ? "is-active" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
