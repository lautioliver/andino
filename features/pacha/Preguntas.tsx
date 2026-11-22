"use client";

import { useEffect, useRef, useState } from "react";
import { type Lang, useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { Button } from "@/shared/ui/Button";

const MAX_PREGUNTA = 200; // igual que en el servidor (preguntar.ts)
const TIMEOUT_MS = 30_000;

interface Turno {
  pregunta: string;
  estado: "pensando" | "listo" | "error";
  respuesta?: string;
  enFuentes?: boolean;
}

/** Preguntas para cuando no hay sugerencias de la IA (lugar elegido a mano o ejemplo). */
function preguntasBase(place: AndinoPlace, lang: Lang): string[] {
  return lang === "en"
    ? [`What makes ${place.name} special?`, `What is the history of ${place.name}?`]
    : [`¿Qué tiene de especial ${place.name}?`, `¿Cuál es la historia de ${place.name}?`];
}

async function preguntar(placeId: string, question: string, lang: Lang, signal: AbortSignal) {
  const en = lang === "en";
  try {
    const res = await fetch("/api/pacha/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeId, question, lang }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.respuesta) return { error: en ? "The AI isn’t available right now." : (body?.error ?? "La IA no está disponible ahora.") };
    return { respuesta: String(body.respuesta), enFuentes: Boolean(body.enFuentes) };
  } catch (e) {
    if (signal.aborted) throw e;
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    return { error: en ? (timeout ? "The AI took too long to answer." : "No connection.") : timeout ? "La IA tardó demasiado en responder." : "Sin conexión." };
  }
}

/** AND-05: preguntas de seguimiento sobre el lugar, respondidas solo con la ficha. */
export function Preguntas({ place, sugerencias }: { place: AndinoPlace; sugerencias?: string[] }) {
  const lang = useLang();
  const en = lang === "en";
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const abort = useRef<AbortController | null>(null);

  // Se monta con key={place.id}: cambiar de lugar empieza una conversación nueva.
  useEffect(() => () => abort.current?.abort(), []);

  const pensando = turnos.at(-1)?.estado === "pensando";
  const hechas = new Set(turnos.map((t) => t.pregunta));
  const opciones = (sugerencias?.length ? sugerencias : preguntasBase(place, lang)).filter((p) => !hechas.has(p));

  async function enviar(pregunta: string) {
    const q = pregunta.trim().slice(0, MAX_PREGUNTA);
    if (!q || pensando) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setTexto("");
    setTurnos((t) => [...t, { pregunta: q, estado: "pensando" }]);
    const r = await preguntar(place.id, q, lang, ctrl.signal).catch(() => null);
    if (!r || ctrl.signal.aborted) return;
    setTurnos((t) =>
      t.map((x, i) =>
        i === t.length - 1
          ? "error" in r
            ? { ...x, estado: "error", respuesta: r.error }
            : { ...x, estado: "listo", respuesta: r.respuesta, enFuentes: r.enFuentes }
          : x,
      ),
    );
  }

  return (
    <section aria-labelledby="preguntas" className="rule mt-14 pt-6">
      <p className="eyebrow text-puna-ink">{en ? "Ask" : "Preguntá"}</p>
      <h2 id="preguntas" className="headline mt-4 text-3xl md:text-4xl">
        {en ? "What else would you like to know?" : "¿Qué más querés saber?"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        {en
          ? `An AI answers using only the ${place.name} card. If something isn't in our sources, it tells you.`
          : `Responde una IA usando solo la ficha de ${place.name}. Si algo no está en nuestras fuentes, te lo dice.`}
      </p>

      {turnos.length > 0 && (
        <ol className="mt-6" aria-live="polite">
          {turnos.map((t, i) => (
            <li key={i} className="rule py-5">
              <p className="headline text-xl">{t.pregunta}</p>
              {t.estado === "pensando" ? (
                <p className="mt-2 text-text-muted">{en ? "Looking it up in the card…" : "Buscando en la ficha…"}</p>
              ) : t.estado === "error" ? (
                <p className="mt-2 text-sm text-text-muted">{t.respuesta} {en ? "Try again in a while." : "Probá de nuevo en un rato."}</p>
              ) : (
                <>
                  <p className="mt-2 leading-7 text-text/85">{t.respuesta}</p>
                  {!t.enFuentes && <p className="eyebrow mt-2 text-puna-ink">{en ? "Not in our sources" : "No está en nuestras fuentes"}</p>}
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {opciones.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {opciones.map((p) => (
            <li key={p}>
              <button type="button" disabled={pensando} onClick={() => enviar(p)} className="min-h-11 rounded-control border border-border bg-surface px-4 py-2 text-left text-sm font-medium text-text shadow-sm transition-colors hover:border-violeta hover:bg-arena disabled:opacity-50">
                {p}
                <span aria-hidden className="text-violeta-ink">&nbsp;→</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <label className="flex-1">
          <span className="sr-only">{en ? `Your question about ${place.name}` : `Tu pregunta sobre ${place.name}`}</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_PREGUNTA}
            placeholder={en ? `Ask something about ${place.name}` : `Preguntá algo sobre ${place.name}`}
            className="min-h-12 w-full rounded-control border border-border bg-surface px-4 text-base shadow-sm outline-none placeholder:text-text-muted focus:border-violeta focus:ring-2 focus:ring-violeta/25"
          />
        </label>
        <Button type="submit" variant="puna" disabled={pensando || !texto.trim()}>
          {en ? "Ask" : "Preguntar"}
        </Button>
      </form>
    </section>
  );
}
