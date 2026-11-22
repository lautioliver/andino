import type { ReactNode } from "react";

// Badge de Abra: fondo Arena, radio 8px, texto de alto contraste.
export function Badge({ children, tone = "violeta" }: { children: ReactNode; tone?: "violeta" | "puna" }) {
  const color = { violeta: "bg-arena text-violeta-ink", puna: "bg-warning-bg text-puna-ink" }[tone];
  return (
    <span className={`eyebrow inline-flex items-center gap-2 rounded-control px-2.5 py-1 ${color}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
