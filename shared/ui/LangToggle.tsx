"use client";

import { type Lang, setLang, useLang } from "@/shared/i18n/lang";

const opciones: { lang: Lang; label: string; nombre: string }[] = [
  { lang: "es", label: "ES", nombre: "Español" },
  { lang: "en", label: "EN", nombre: "English" },
];

/** Selector de idioma: dos botones, el activo marcado. */
export function LangToggle() {
  const actual = useLang();
  return (
    <div role="group" aria-label="Idioma / Language" className="flex rounded-control bg-inset p-1 text-xs font-semibold">
      {opciones.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          aria-label={o.nombre}
          aria-pressed={actual === o.lang}
          onClick={() => setLang(o.lang)}
          className="min-h-9 min-w-10 rounded-[6px] px-2 text-text-muted transition-colors aria-pressed:bg-surface aria-pressed:text-violeta-ink aria-pressed:shadow-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
