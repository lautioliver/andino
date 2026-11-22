"use client";

import { useSyncExternalStore } from "react";

// Idioma de la interfaz: español o inglés. Arranca con el del teléfono y se recuerda en este navegador.
// En el servidor (y al prerender) siempre es español: el cliente cambia al hidratar, sin desajuste.
export type Lang = "es" | "en";

const CLAVE = "andino:lang";
const oyentes = new Set<() => void>();

function leer(): Lang {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "es" || guardado === "en") return guardado;
  } catch {}
  return typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("es") ? "en" : "es";
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(CLAVE, lang);
  } catch {}
  document.documentElement.lang = lang === "es" ? "es-AR" : "en";
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function useLang(): Lang {
  return useSyncExternalStore(suscribir, leer, () => "es");
}

/** Elige el diccionario del idioma actual: `const t = useT(textos)`. */
export function useT<T>(dict: Record<Lang, T>): T {
  return dict[useLang()];
}
