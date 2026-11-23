// «Escuchar»: una sola lectura en voz alta para toda la app, con la síntesis de voz del navegador
// (window.speechSynthesis): sin dependencias ni servicios propios. Qué voz y cómo se parte el texto: voz.ts.
// El botón está en Escuchar.tsx. Nada de esto corre al cargar el módulo: en el servidor no hay window.
import type { Lang } from "@/shared/i18n/lang";
import { elegirVoz, partirEnOraciones } from "./voz";

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

/** La voz elegida para cada idioma, o null mientras el navegador no ofrezca ninguna. */
const voces: Record<Lang, SpeechSynthesisVoice | null> = { es: null, en: null };
let hayLista = false;

/** La lectura en curso. Guarda los enunciados: si el navegador los descarta, no avisa cuando terminan. */
let enCurso: { id: string; enunciados: SpeechSynthesisUtterance[] } | null = null;
/** Cada lectura (y cada corte) tiene su turno: lo que avise un enunciado de un turno anterior ya no cuenta. */
let turno = 0;

function sintesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || typeof window.SpeechSynthesisUtterance !== "function") return null;
  return window.speechSynthesis ?? null;
}

function mirarVoces() {
  let lista: SpeechSynthesisVoice[] = [];
  try {
    lista = sintesis()?.getVoices() ?? [];
  } catch {}
  // Una lista vacía después de una con voces es el navegador que todavía no contestó: vale la anterior.
  if (lista.length === 0) return;
  hayLista = true;
  const antes = `${voces.es !== null}${voces.en !== null}`;
  voces.es = elegirVoz(lista, "es");
  voces.en = elegirVoz(lista, "en");
  if (antes !== `${voces.es !== null}${voces.en !== null}`) avisar();
}

// Las voces llegan cuando quieren: Chrome avisa con «voiceschanged»; un iPhone puede dar la lista vacía al
// principio y no avisar nunca. Por eso, además del aviso, se vuelve a mirar unas veces, cada vez más espaciadas.
const ESPERAS_MS = [250, 500, 1000, 2000, 4000];
let reintento: ReturnType<typeof setTimeout> | null = null;

function buscarVoces(intento = 0) {
  if (reintento !== null) clearTimeout(reintento);
  reintento = null;
  mirarVoces();
  if (hayLista || intento >= ESPERAS_MS.length) return;
  reintento = setTimeout(() => buscarVoces(intento + 1), ESPERAS_MS[intento]);
}

let preparado = false;

/** Lo que vale para toda la app, una sola vez: enterarse de las voces y callarse cuando la página no se ve. */
function preparar() {
  const s = sintesis();
  if (!s) return;
  if (!preparado) {
    preparado = true;
    // En Safari viejo la síntesis no recibe eventos: quedan los reintentos.
    if (typeof s.addEventListener === "function") s.addEventListener("voiceschanged", mirarVoces);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) detener();
      else if (!hayLista) buscarVoces();
    });
    // Al salir o recargar: si no, Chrome sigue hablando sobre la página siguiente.
    window.addEventListener("pagehide", () => detener());
  }
  if (!hayLista && reintento === null) buscarVoces();
}

/** Para useSyncExternalStore: avisa cuando cambia la lectura en curso o las voces disponibles. */
export function suscribir(f: () => void): () => void {
  oyentes.add(f);
  preparar();
  return () => {
    oyentes.delete(f);
  };
}

/** ¿Hay una voz para leer en ese idioma? Sin síntesis, o sin voz de ese idioma, no. */
export function hayVoz(lang: Lang): boolean {
  return voces[lang] !== null;
}

/** El `id` de quien está leyendo, o null. */
export function lecturaActiva(): string | null {
  return enCurso?.id ?? null;
}

/**
 * Lee esos párrafos en voz alta, en ese idioma. Corta la lectura que hubiera: hay una sola a la vez.
 * Hay que llamarla desde el toque de la persona: el navegador no deja empezar a hablar de otra manera.
 */
export function leer(id: string, parrafos: string[], lang: Lang) {
  const s = sintesis();
  if (!s) return;
  mirarVoces();
  const voz = voces[lang];
  const tramos = parrafos.flatMap((p) => partirEnOraciones(p));
  if (!voz || tramos.length === 0) return;

  const mio = ++turno;
  if (enCurso || s.speaking || s.pending) s.cancel();
  const enunciados = tramos.map((tramo) => {
    const e = new SpeechSynthesisUtterance(tramo);
    e.voice = voz;
    // Por si el navegador elige por el idioma del enunciado y no por `voice` (se cuenta de Chrome en Android).
    e.lang = voz.lang.replace(/_/g, "-");
    e.onerror = () => {
      if (mio === turno) detener();
    };
    return e;
  });
  enunciados[enunciados.length - 1].onend = () => {
    if (mio !== turno) return;
    enCurso = null;
    avisar();
  };
  enCurso = { id, enunciados };
  avisar();
  try {
    for (const e of enunciados) s.speak(e);
  } catch {
    detener();
  }
}

/** Corta la lectura en curso; con `id`, solo si es la de ese botón. */
export function detener(id?: string) {
  if (!enCurso || (id !== undefined && enCurso.id !== id)) return;
  turno++;
  enCurso = null;
  try {
    sintesis()?.cancel();
  } catch {}
  avisar();
}
