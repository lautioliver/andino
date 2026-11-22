import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BottomNav, TopNav } from "./NavLinks";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <nav aria-label="Principal" className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 md:px-6">
          <Link href="/" className="display text-2xl tracking-tight">
            Andino
          </Link>
          <Suspense>
            <TopNav />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-28 md:px-6 md:pb-16">{children}</main>
      <footer className="mx-auto hidden w-full max-w-[1120px] px-6 pb-8 text-xs text-text-muted md:block">
        <p className="rule pt-4">ANDINO · Cursor Hackathon Jujuy · Sin afiliación con SpaceX.</p>
      </footer>
      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-30 bg-bg/95 backdrop-blur-sm md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Suspense>
          <BottomNav />
        </Suspense>
      </nav>
    </div>
  );
}
