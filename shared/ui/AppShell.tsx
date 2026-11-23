import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AndinoMark } from "./AndinoMark";
import { LangToggle } from "./LangToggle";
import { LuzRojaEncendida } from "./LuzRoja";
import { Dock, Pie, TopNav } from "./NavLinks";

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
            <LuzRojaEncendida />
            <LangToggle />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-16 md:px-6">{children}</main>
      {/* En el teléfono el pie deja lugar para el dock, que flota: 76px + el área segura, más aire. */}
      <footer className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(110px+env(safe-area-inset-bottom))] text-xs text-text-muted md:px-6 md:pb-8">
        <Pie />
      </footer>
      <Suspense>
        <Dock />
      </Suspense>
    </div>
  );
}
