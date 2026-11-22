"use client";

import { useId, useMemo, useState } from "react";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { describirAltura, queryCielo, rumbo } from "@/features/cielo/cielo";
import { mejorMomento, tuCumpleEnElCielo } from "./signo";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const enArgentina = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Jujuy",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO → { fecha: "YYYY-MM-DD", hora: "HH:MM" } en la hora de Argentina. */
function fechaYHora(datetimeISO: string): { fecha: string; hora: string } {
  const p = Object.fromEntries(enArgentina.formatToParts(new Date(datetimeISO)).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/**
 * «Tu signo en el cielo»: con tu cumpleaños, dónde estaba de verdad el Sol ese día y cuándo buscar
 * la constelación de tu signo esta noche. La fecha no sale del teléfono: no se guarda ni va en la URL.
 */
export function TuSigno({ place, fecha }: { place: AndinoPlace; fecha: string }) {
  const id = useId();
  const [cumple, setCumple] = useState("");

  const resultado = useMemo(() => {
    if (!FECHA.test(cumple) || Number.isNaN(new Date(`${cumple}T12:00:00Z`).getTime())) return null;
    const cielo = tuCumpleEnElCielo(cumple);
    const momento = mejorMomento(cielo.horoscopo.id, place, fecha);
    return { ...cielo, momento: momento ? { ...momento, ...fechaYHora(momento.datetimeISO) } : null };
  }, [cumple, place, fecha]);

  return (
    <div className="mt-12 rounded-card border border-border bg-surface-subtle p-5 md:p-6">
      <p className="eyebrow text-text-muted">Tu signo en el cielo</p>
      <label htmlFor={id} className="lead mt-4 block text-text/85">
        ¿Cuándo es tu cumpleaños?
      </label>
      <input
        id={id}
        type="date"
        value={cumple}
        onChange={(e) => setCumple(e.target.value)}
        className="mt-3 min-h-12 rounded-control border border-border bg-surface px-3 text-text shadow-sm focus:border-violeta"
      />

      {resultado ? (
        <div className="mt-6 grid gap-4" aria-live="polite">
          <p className="lead text-text/85">
            Según el horóscopo sos <span className="text-violeta-ink">{resultado.horoscopo.nombre}</span>.{" "}
            {resultado.coinciden ? (
              <>Ese día el Sol estaba, de verdad, en la constelación de {resultado.sol.nombre}.</>
            ) : (
              <>
                Pero ese día el Sol estaba en la constelación de <span className="text-violeta-ink">{resultado.sol.nombre}</span>.
              </>
            )}
          </p>
          <p className="lead text-text/85">
            {resultado.momento ? (
              <>
                Esta noche, el mejor momento para buscar {resultado.horoscopo.nombre} es a las {resultado.momento.hora}:
                hacia el {rumbo(resultado.momento.posicion.az)}, {describirAltura(resultado.momento.posicion.alt)}.
              </>
            ) : (
              <>
                Esta noche {resultado.horoscopo.nombre} no sube lo suficiente con el cielo oscuro: está del lado del
                Sol. Se ve mejor en otra época del año.
              </>
            )}
          </p>
          <p className="text-sm leading-6 text-text-muted">
            Las fechas del horóscopo se fijaron hace unos 2.000 años. Desde entonces el eje de la Tierra se corrió
            (la precesión) y hoy el Sol pasa por cada constelación, en promedio, casi un mes más tarde. Además, cruza una
            decimotercera, Ofiuco. Esto es astronomía: no hace predicciones.
          </p>
          {resultado.momento ? (
            <LinkButton
              variant="ghost"
              href={`/cielo${queryCielo(place.id, { fecha: resultado.momento.fecha, hora: resultado.momento.hora })}`}
            >
              Ver el cielo a esa hora
            </LinkButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
