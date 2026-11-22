"use client";

import { useEffect, useRef, useState } from "react";
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
function preguntasBase(place: AndinoPlace): string[] {
  return [`¿Qué tiene de especial ${place.name}?`, "¿Por qué la Quebrada de Humahuaca es Patrimonio Mundial?"];
}

async function preguntar(placeId: string, question: string, signal: AbortSignal) {
  try {
    const res = await fetch("/api/pacha/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placeId, question }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.respuesta) return { error: body?.error ?? "La IA no está disponible ahora." };
    return { respuesta: String(body.respuesta), enFuentes: Boolean(body.enFuentes) };
  } catch (e) {
    if (signal.aborted) throw e;
    return { error: e instanceof DOMException && e.name === "TimeoutError" ? "La IA tardó demasiado en responder." : "Sin conexión." };
  }
}

/** AND-05: preguntas de seguimiento sobre el lugar, respondidas solo con la ficha. */
export function Preguntas({ place, sugerencias }: { place: AndinoPlace; sugerencias?: string[] }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState("");
  const abort = useRef<AbortController | null>(null);

  // Se monta con key={place.id}: cambiar de lugar empieza una conversación nueva.
  useEffect(() => () => abort.current?.abort(), []);

  const pensando = turnos.at(-1)?.estado === "pensando";
  const hechas = new Set(turnos.map((t) => t.pregunta));
  const opciones = (sugerencias?.length ? sugerencias : preguntasBase(place)).filter((p) => !hechas.has(p));

  async function enviar(pregunta: string) {
    const q = pregunta.trim().slice(0, MAX_PREGUNTA);
    if (!q || pensando) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setTexto("");
    setTurnos((t) => [...t, { pregunta: q, estado: "pensando" }]);
    const r = await preguntar(place.id, q, ctrl.signal).catch(() => null);
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
      <p className="eyebrow text-earth">Preguntá</p>
      <h2 id="preguntas" className="headline mt-4 text-3xl md:text-4xl">
        ¿Qué más querés saber?
      </h2>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        Responde una IA usando solo la ficha de {place.name}. Si algo no está en nuestras fuentes, te lo dice.
      </p>

      {turnos.length > 0 && (
        <ol className="mt-6" aria-live="polite">
          {turnos.map((t, i) => (
            <li key={i} className="rule py-5">
              <p className="headline text-xl">{t.pregunta}</p>
              {t.estado === "pensando" ? (
                <p className="mt-2 text-text-muted">Buscando en la ficha…</p>
              ) : t.estado === "error" ? (
                <p className="mt-2 text-sm text-text-muted">{t.respuesta} Probá de nuevo en un rato.</p>
              ) : (
                <>
                  <p className="mt-2 leading-7 text-text/85">{t.respuesta}</p>
                  {!t.enFuentes && <p className="eyebrow mt-2 text-sand">No está en nuestras fuentes</p>}
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {opciones.length > 0 && (
        <ul className="mt-6 space-y-2">
          {opciones.map((p) => (
            <li key={p}>
              <button type="button" disabled={pensando} onClick={() => enviar(p)} className="min-h-12 py-2 text-left font-medium text-earth transition-colors hover:text-sand disabled:opacity-50">
                {p}
                <span aria-hidden>&nbsp;→</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Tu pregunta sobre {place.name}</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_PREGUNTA}
            placeholder={`Preguntá algo sobre ${place.name}`}
            className="w-full border-b border-text/30 bg-transparent py-2 text-base outline-none placeholder:text-text-muted focus:border-earth"
          />
        </label>
        <Button type="submit" variant="ghost" disabled={pensando || !texto.trim()}>
          Preguntar
        </Button>
      </form>
    </section>
  );
}
