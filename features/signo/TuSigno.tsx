"use client";

import { useId, useMemo, useState } from "react";
import { Escuchar } from "@/features/escuchar/Escuchar";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { describirAltura, queryCielo, rumbo } from "@/features/cielo/cielo";
import { mejorMomento, NOMBRES_EN, tuCumpleEnElCielo } from "./signo";

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
  const lang = useLang();
  const en = lang === "en";
  const [cumple, setCumple] = useState("");

  const resultado = useMemo(() => {
    if (!FECHA.test(cumple) || Number.isNaN(new Date(`${cumple}T12:00:00Z`).getTime())) return null;
    const cielo = tuCumpleEnElCielo(cumple);
    const momento = mejorMomento(cielo.horoscopo.id, place, fecha);
    return { ...cielo, momento: momento ? { ...momento, ...fechaYHora(momento.datetimeISO) } : null };
  }, [cumple, place, fecha]);
  const signo = resultado ? (en ? NOMBRES_EN[resultado.horoscopo.constelacion] : resultado.horoscopo.nombre) : "";
  const sol = resultado ? (en ? (NOMBRES_EN[resultado.sol.id] ?? resultado.sol.nombre) : resultado.sol.nombre) : "";

  return (
    <div className="mt-12 rounded-card border border-border bg-surface-subtle p-5 md:p-6" data-escuchable>
      <p className="eyebrow text-text-muted" data-leer>
        {en ? "Your sign in the sky" : "Tu signo en el cielo"}
      </p>
      <label htmlFor={id} className="lead mt-4 block text-text/85">
        {en ? "When is your birthday?" : "¿Cuándo es tu cumpleaños?"}
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
          {/* Se lee el título y el resultado, no la pregunta del cumpleaños. */}
          <Escuchar clave={`${cumple} ${place.id} ${fecha}`} className="justify-self-start" />
          <p className="lead text-text/85" data-leer>
            {en ? "According to the horoscope you're " : "Según el horóscopo sos "}
            <span className="text-violeta-ink">{signo}</span>.{" "}
            {resultado.coinciden ? (
              en ? (
                <>On that day the Sun really was in the constellation {sol}.</>
              ) : (
                <>Ese día el Sol estaba, de verdad, en la constelación de {sol}.</>
              )
            ) : (
              <>
                {en ? "But on that day the Sun was in the constellation " : "Pero ese día el Sol estaba en la constelación de "}
                <span className="text-violeta-ink">{sol}</span>.
              </>
            )}
          </p>
          <p className="lead text-text/85" data-leer>
            {resultado.momento
              ? en
                ? `Tonight, the best time to look for ${signo} is at ${resultado.momento.hora}: to the ${rumbo(resultado.momento.posicion.az, lang)}, ${describirAltura(resultado.momento.posicion.alt, lang)}.`
                : `Esta noche, el mejor momento para buscar ${signo} es a las ${resultado.momento.hora}: hacia el ${rumbo(resultado.momento.posicion.az)}, ${describirAltura(resultado.momento.posicion.alt)}.`
              : en
                ? `Tonight ${signo} doesn't rise high enough while the sky is dark: it's on the Sun's side. It's best seen at another time of year.`
                : `Esta noche ${signo} no sube lo suficiente con el cielo oscuro: está del lado del Sol. Se ve mejor en otra época del año.`}
          </p>
          <p className="text-sm leading-6 text-text-muted" data-leer>
            {en
              ? "The horoscope dates were set about 2,000 years ago. Since then Earth's axis has shifted (precession), and today the Sun passes through each constellation almost a month later on average. It also crosses a thirteenth one, Ophiuchus. This is astronomy: it makes no predictions."
              : "Las fechas del horóscopo se fijaron hace unos 2.000 años. Desde entonces el eje de la Tierra se corrió (la precesión) y hoy el Sol pasa por cada constelación, en promedio, casi un mes más tarde. Además, cruza una decimotercera, Ofiuco. Esto es astronomía: no hace predicciones."}
          </p>
          {resultado.momento ? (
            <LinkButton
              variant="ghost"
              href={`/cielo${queryCielo(place.id, { fecha: resultado.momento.fecha, hora: resultado.momento.hora })}`}
            >
              {en ? "See the sky at that time" : "Ver el cielo a esa hora"}
            </LinkButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
