import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Inicio" },
  { href: "/explorar", label: "Explorar" },
  { href: "/cielo", label: "Cielo" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-3">
          <Link href="/" className="font-display text-lg font-bold tracking-wide">
            ANDINO
          </Link>
          <nav aria-label="Principal" className="hidden gap-6 text-sm text-text-muted md:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-text">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-6 pb-24 md:pb-10">{children}</main>
      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-3">
          {nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-12 items-center justify-center text-sm text-text-muted">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
