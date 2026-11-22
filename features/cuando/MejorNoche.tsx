"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { queryCielo } from "@/features/cielo/cielo";
import { fechasDesde, hora, mejorNoche, type NocheDeCielo } from "./cuando";

const DURACIONES = [3, 7, 14] as const;

const loc = (en: boolean) => (en ? "en-US" : "es-AR");
const diaLargo = (en: boolean) => new Intl.DateTimeFormat(loc(en), { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const diaCorto = (en: boolean) => new Intl.DateTimeFormat(loc(en), { timeZone: "UTC", weekday: "short", day: "numeric" });
const dia = (fecha: string, f: Intl.DateTimeFormat) => f.format(new Date(`${fecha}T12:00:00Z`));

function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** /cielo en el medio de la franja oscura, con la fecha del calendario de ese momento. */
function hrefDelMedio(placeId: string, n: NocheDeCielo): string | null {
  if (!n.franja) return null;
  const desde = new Date(n.franja.desde).getTime();
  const hasta = new Date(n.franja.hasta).getTime();
  const medio = Math.round((desde + hasta) / 2 / 300_000) * 300_000;
  const local = new Date(medio - 3 * 3600_000).toISOString();
  return `/cielo${queryCielo(placeId, { fecha: local.slice(0, 10), hora: local.slice(11, 16) })}`;
}

/** «Cuándo»: de las próximas noches, cuál tiene más cielo oscuro. `fecha` es la de esta noche. */
export function MejorNoche({ place, fecha }: { place: AndinoPlace; fecha: string }) {
  const en = useLang() === "en";
  const [noches, setNoches] = useState<(typeof DURACIONES)[number]>(7);
  const { noches: lista, mejor } = useMemo(
    () => mejorNoche(place, fechasDesde(fecha, noches)),
    [place, fecha, noches],
  );
  const maximo = Math.max(...lista.map((n) => n.minutosOscuros), 1);
  const href = mejor ? hrefDelMedio(place.id, mejor) : null;

  return (
    <div className="card mt-8 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="eyebrow text-text-muted">{en ? "When" : "Cuándo"}</p>
        <div role="group" aria-label={en ? "Nights of your trip" : "Noches de tu viaje"} className="flex gap-1 rounded-control bg-inset p-1 text-sm">
          {DURACIONES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === noches}
              onClick={() => setNoches(d)}
              className={`min-h-10 rounded-[6px] px-3 font-medium ${d === noches ? "bg-surface text-violeta-ink shadow-sm" : "text-text-muted hover:text-text"}`}
            >
              {d} {en ? "nights" : "noches"}
            </button>
          ))}
        </div>
      </div>

      {mejor?.franja ? (
        <p className="lead mt-4 text-text/85">
          {mejor.fecha === fecha ? (
            en ? (
              <>
                <span className="text-violeta-ink">Tonight</span> is the best of the next {noches}
              </>
            ) : (
              <>
                <span className="text-violeta-ink">Esta noche</span> es la mejor de las próximas {noches}
              </>
            )
          ) : en ? (
            <>
              The best of the next {noches} is <span className="text-violeta-ink">{dia(mejor.fecha, diaLargo(en))}</span>
            </>
          ) : (
            <>
              La mejor de las próximas {noches} es la del <span className="text-violeta-ink">{dia(mejor.fecha, diaLargo(en))}</span>
            </>
          )}
          {en
            ? `: dark sky with no Moon from ${hora(mejor.franja.desde)} to ${hora(mejor.franja.hasta)} (${duracion(mejor.minutosOscuros)}).`
            : `: cielo oscuro y sin Luna de ${hora(mejor.franja.desde)} a ${hora(mejor.franja.hasta)} (${duracion(mejor.minutosOscuros)}).`}
        </p>
      ) : (
        <p className="lead mt-4 text-text/85">
          {en
            ? `Over the next ${noches} nights the Moon lights up the sky whenever it's dark. Try a longer trip.`
            : `En las próximas ${noches} noches la Luna ilumina el cielo todo el tiempo que está oscuro. Probá con un viaje más largo.`}
        </p>
      )}

      <ol className="mt-6" aria-label={en ? "Hours of dark sky per night" : "Horas de cielo oscuro por noche"}>
        {lista.map((n) => (
          <li key={n.fecha} className="grid grid-cols-[5.5rem_1fr_auto] border-t border-border-subtle items-center gap-4 py-2 text-sm">
            <span className={n === mejor ? "font-semibold text-violeta-ink" : "text-text-muted"}>{dia(n.fecha, diaCorto(en))}</span>
            <span className="h-2 overflow-hidden rounded-full bg-arena" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${n === mejor ? "bg-gradient-to-r from-puna to-violeta" : "bg-violeta/40"}`}
                style={{ width: `${(n.minutosOscuros / maximo) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-text-muted">
              {n.franja ? `${hora(n.franja.desde)}–${hora(n.franja.hasta)}` : en ? "Moonlit" : "con Luna"}
              <span className="sr-only">
                , {en ? "Moon at" : "Luna al"} {Math.round(n.lunaIluminada * 100)} %
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm leading-6 text-text-muted">
        {en
          ? "It counts as dark once twilight is over (Sun more than 18° below the horizon) and the Moon is down or almost new. Clouds and mountains aren't taken into account."
          : "Cuenta como oscuro cuando terminó el crepúsculo (Sol a más de 18° bajo el horizonte) y la Luna no está arriba o está casi nueva. No tiene en cuenta nubes ni cerros."}
      </p>

      {href && mejor && mejor.fecha !== fecha ? (
        <LinkButton variant="ghost" href={href} className="mt-2">
          {en ? "See that night's sky" : "Ver el cielo de esa noche"}
        </LinkButton>
      ) : null}
    </div>
  );
}
