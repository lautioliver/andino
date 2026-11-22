import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AndinoMark } from "./AndinoMark";
import { LangToggle } from "./LangToggle";
import { BottomNav, Pie, TopNav } from "./NavLinks";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <nav aria-label="Principal" className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2 font-display text-xl font-bold tracking-tight">
            <AndinoMark className="size-7" />
            Andino
          </Link>
          <div className="flex items-center gap-3 md:gap-6">
            <Suspense>
              <TopNav />
            </Suspense>
            <LangToggle />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-16 md:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-[1120px] px-4 pb-28 text-xs text-text-muted md:px-6 md:pb-8">
        <Pie />
      </footer>
      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Suspense>
          <BottomNav />
        </Suspense>
      </nav>
    </div>
  );
}
