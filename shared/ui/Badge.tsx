import type { ReactNode } from "react";

// Etiqueta textual (no pastilla): punto de color + mayúsculas espaciadas.
export function Badge({ children, tone = "sand" }: { children: ReactNode; tone?: "sand" | "sky" | "earth" }) {
  const color = { sand: "text-sand", sky: "text-sky", earth: "text-earth" }[tone];
  return (
    <span className={`eyebrow inline-flex items-center gap-2 ${color}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
