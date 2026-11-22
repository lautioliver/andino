"use client";

import { useEffect, useState } from "react";
import { rumbo } from "@/features/cielo/cielo";
import type { PlaceId } from "@/shared/types";
import type { PasosDeLaNoche, PasoVisible } from "./pasos";

const hora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Jujuy",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dia = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Jujuy", day: "numeric", month: "long" });

type Estado = { estado: "cargando" } | { estado: "listo"; pasos: PasosDeLaNoche } | { estado: "error"; mensaje: string };

function titulo(p: PasoVisible): string {
  if (p.satelites === 1) return `${hora.format(new Date(p.maximo))} · ${p.nombre}`;
  const minutos = Math.max(1, Math.round(p.intervaloSeg / 60));
  const cada = p.intervaloSeg <= 90 ? "casi juntos" : `uno cada ~${minutos} min`;
  return `${hora.format(new Date(p.maximo))}–${hora.format(new Date(p.fin))} · ${p.nombre}, ${cada}`;
}

function recorrido(p: PasoVisible): string {
  const desde = rumbo(p.desdeAzDeg);
  const hasta = rumbo(p.hastaAzDeg);
  const camino = desde === hasta ? `por el ${desde}` : `del ${desde} al ${hasta}`;
  return `${p.satelites === 1 ? "Cruza" : "Cruzan"} ${camino}, hasta ${p.alturaMaxDeg}° de altura`;
}

/** Pasos de Starlink de esta noche, para la sección «Esta noche» de la ficha. */
export function PasosStarlink({ placeId, fecha }: { placeId: PlaceId; fecha: string }) {
  const [s, setS] = useState<Estado>({ estado: "cargando" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/satelites/starlink?placeId=${placeId}&fecha=${fecha}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        setS(r.ok && body ? { estado: "listo", pasos: body } : { estado: "error", mensaje: body?.error ?? "No disponible ahora." });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setS({ estado: "error", mensaje: "Sin conexión." });
      });
    return () => ctrl.abort();
  }, [placeId, fecha]);

  return (
    <div className="mt-10">
      <p className="eyebrow text-sky">Satélites Starlink</p>
      {s.estado === "cargando" ? (
        <p className="mt-3 text-sm text-text-muted">Calculando los pasos de esta noche…</p>
      ) : s.estado === "error" ? (
        <p className="mt-3 text-sm text-text-muted">{s.mensaje}</p>
      ) : s.pasos.destacados.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Esta noche no hay pasos altos de Starlink al terminar el crepúsculo.</p>
      ) : (
        <>
          <ul className="mt-2">
            {s.pasos.destacados.map((p) => (
              <li key={`${p.nombre}-${p.maximo}`} className="rule flex flex-col gap-1 py-4">
                <span className="headline text-xl">{titulo(p)}</span>
                <span className="text-sm text-text-muted">
                  {recorrido(p)}
                  {p.recienLanzado ? " · lanzamiento reciente, suelen verse más" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-text-muted">
            Desde las {hora.format(new Date(s.pasos.desde))}, cuando termina el crepúsculo, hay {s.pasos.totalPasos} pasos de
            Starlink sobre 10° hasta las {hora.format(new Date(s.pasos.hasta))}. Se ven como puntos que avanzan sin parpadear;
            la mayoría son tenues y hace falta un cielo oscuro y sin Luna brillante. Órbitas públicas de CelesTrak,
            actualizadas el {dia.format(new Date(s.pasos.tleActualizado))}.
          </p>
        </>
      )}
    </div>
  );
}
