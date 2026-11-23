"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { useLang } from "@/shared/i18n/lang";
import { detener, hayVoz, lecturaActiva, leer, suscribir } from "./lector";

const textos = {
  es: { escuchar: "Escuchar", detener: "Detener" },
  en: { escuchar: "Listen", detener: "Stop" },
};

/** Los textos marcados con `data-leer` en la tarjeta (`data-escuchable`) que contiene al botón, en el orden en que se ven. */
function loQueSeVe(boton: HTMLElement): string[] {
  const tarjeta = boton.closest("[data-escuchable]");
  return tarjeta ? Array.from(tarjeta.querySelectorAll("[data-leer]"), (e) => e.textContent ?? "") : [];
}

/**
 * «Escuchar»: lee en voz alta, en el idioma de la app, lo que explica la tarjeta donde está. Alterna con «Detener».
 *
 * La tarjeta se marca con `data-escuchable` y, adentro, cada texto que se lee con `data-leer`: se lee lo que
 * está escrito en la pantalla, sin una segunda copia de los textos. Lo que no lleva la marca (fuentes, citas,
 * enlaces, cifras) no se lee.
 *
 * `clave` dice qué se está explicando: cuando cambia (otro objeto, otra fecha), la lectura se corta. No es
 * el texto, porque en /cielo la posición se recalcula sola mientras se escucha.
 *
 * Si el navegador no tiene síntesis de voz, o no tiene una voz para el idioma, el botón no se muestra.
 */
export function Escuchar({ clave, className = "" }: { clave: string; className?: string }) {
  const lang = useLang();
  const id = useId();
  const hay = useSyncExternalStore(
    suscribir,
    () => hayVoz(lang),
    () => false,
  );
  const leyendo = useSyncExternalStore(
    suscribir,
    () => lecturaActiva() === id,
    () => false,
  );

  // Se corta al cambiar lo que se explica o el idioma, al desmontar y al navegar: con cacheComponents Next
  // no desmonta la pantalla anterior, la esconde, y lo que corre entonces es esta limpieza.
  useEffect(() => () => detener(id), [id, clave, lang]);

  if (!hay) return null;
  const t = textos[lang];
  return (
    <button
      type="button"
      aria-pressed={leyendo}
      onClick={(e) => (leyendo ? detener(id) : leer(id, loQueSeVe(e.currentTarget), lang))}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-semibold text-violeta-ink shadow-sm transition-colors hover:bg-arena aria-pressed:border-violeta aria-pressed:bg-arena ${className}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {leyendo ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
        ) : (
          <>
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        )}
      </svg>
      {leyendo ? t.detener : t.escuchar}
    </button>
  );
}
