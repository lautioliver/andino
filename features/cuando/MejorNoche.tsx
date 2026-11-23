"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { queryCielo } from "@/features/cielo/cielo";
import { Avisame } from "./Avisame";
import { fechasDesde, hora, mejorNoche, type NocheDeCielo } from "./cuando";
import { CreditoOpenMeteo, palabraDeNubes, porciento, type Pronostico, useNubes } from "./Nubes";

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

/** Por qué se eligió esa noche, con la cuenta a la vista: minutos oscuros × parte del cielo sin nubes. */
function porQue(mejor: NocheDeCielo, masOscura: NocheDeCielo | null, pronostico: Pronostico["estado"], en: boolean): string {
  if (mejor.nubes === null) {
    if (pronostico === "sin") {
      return en
        ? "We couldn't load the cloud forecast: this pick is based on dark hours alone."
        : "No pudimos traer el pronóstico de nubes: la elegimos solo por las horas de cielo oscuro.";
    }
    return en
      ? "There's no cloud forecast for that night yet: this pick is based on dark hours alone."
      : "Todavía no hay pronóstico de nubes para esa noche: la elegimos solo por las horas de cielo oscuro.";
  }

  const cielo = palabraDeNubes(mejor.nubes, en);
  const despejados = Math.round(mejor.puntaje);
  const partes = [
    en
      ? `The forecast calls for ${cielo} skies during those hours (${porciento(mejor.nubes, en)} cloud cover).`
      : `El pronóstico da cielo ${cielo} en esas horas (${porciento(mejor.nubes, en)} de nubes).`,
  ];
  if (despejados === 0) {
    // Si la mejor queda en cero, todas las noches oscuras con pronóstico están cubiertas.
    partes.push(en ? "Every dark night looks overcast: check again closer to the date." : "Todas las noches oscuras vienen cubiertas: volvé a mirar más cerca de la fecha.");
  } else {
    const cuenta = `${duracion(mejor.minutosOscuros)} × ${porciento(100 - mejor.nubes, en)} ≈ ${duracion(despejados)}`;
    partes.push(
      en
        ? `We picked it because it promises the most dark, cloud-free sky: ${cuenta}.`
        : `La elegimos porque es la que más cielo oscuro sin nubes promete: ${cuenta}.`,
    );
  }
  if (masOscura && masOscura.nubes !== null && masOscura.minutosOscuros > mejor.minutosOscuros && masOscura.nubes > mejor.nubes) {
    const otra = dia(masOscura.fecha, diaLargo(en));
    partes.push(
      en
        ? `The night of ${otra} has more dark hours (${duracion(masOscura.minutosOscuros)}) but more clouds in the forecast (${porciento(masOscura.nubes, en)}).`
        : `La del ${otra} tiene más horas oscuras (${duracion(masOscura.minutosOscuros)}), pero más nubes en el pronóstico (${porciento(masOscura.nubes, en)}).`,
    );
  }
  return partes.join(" ");
}

/** «Cuándo»: de las próximas noches, cuál promete más cielo oscuro y despejado. `fecha` es la de esta noche. */
export function MejorNoche({ place, fecha }: { place: AndinoPlace; fecha: string }) {
  const en = useLang() === "en";
  const [noches, setNoches] = useState<(typeof DURACIONES)[number]>(7);
  const pronostico = useNubes(place.id);
  const { noches: lista, mejor, masOscura } = useMemo(
    () => mejorNoche(place, fechasDesde(fecha, noches), pronostico.nubes),
    [place, fecha, noches, pronostico.nubes],
  );
  // Hasta saber si hay pronóstico no se anuncia una mejor noche: podría cambiar al llegar las nubes.
  const cargando = pronostico.estado === "cargando";
  const elegida = cargando ? null : mejor;
  const maximo = Math.max(...lista.map((n) => n.minutosOscuros), 1);
  const href = elegida ? hrefDelMedio(place.id, elegida) : null;

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

      <div aria-live="polite">
        {cargando ? (
          <p className="lead mt-4 text-text-muted">
            {en ? "Checking the cloud forecast to pick the best night…" : "Buscando el pronóstico de nubes para elegir la mejor noche…"}
          </p>
        ) : elegida?.franja ? (
          <>
            <p className="lead mt-4 text-text/85">
              {elegida.fecha === fecha ? (
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
                  The best of the next {noches} is <span className="text-violeta-ink">{dia(elegida.fecha, diaLargo(en))}</span>
                </>
              ) : (
                <>
                  La mejor de las próximas {noches} es la del <span className="text-violeta-ink">{dia(elegida.fecha, diaLargo(en))}</span>
                </>
              )}
              {en
                ? `: dark sky with no Moon from ${hora(elegida.franja.desde)} to ${hora(elegida.franja.hasta)} (${duracion(elegida.minutosOscuros)}).`
                : `: cielo oscuro y sin Luna de ${hora(elegida.franja.desde)} a ${hora(elegida.franja.hasta)} (${duracion(elegida.minutosOscuros)}).`}
            </p>
            <p className="mt-3 leading-7 text-text-muted">{porQue(elegida, masOscura, pronostico.estado, en)}</p>
            <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3">
              <Avisame placeId={place.id} noche={elegida} esHoy={elegida.fecha === fecha} />
              {href && elegida.fecha !== fecha ? (
                <LinkButton variant="ghost" href={href} className="min-h-12">
                  {en ? "See that night's sky" : "Ver el cielo de esa noche"}
                </LinkButton>
              ) : null}
            </div>
          </>
        ) : (
          <p className="lead mt-4 text-text/85">
            {en
              ? `Over the next ${noches} nights the Moon lights up the sky whenever it's dark. Try a longer trip.`
              : `En las próximas ${noches} noches la Luna ilumina el cielo todo el tiempo que está oscuro. Probá con un viaje más largo.`}
          </p>
        )}
      </div>

      <ol className="mt-6" aria-label={en ? "Dark sky and clouds per night" : "Cielo oscuro y nubes por noche"}>
        {lista.map((n) => (
          <li key={n.fecha} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-4 border-t border-border-subtle py-2 text-sm">
            <span className={n === elegida ? "font-semibold text-violeta-ink" : "text-text-muted"}>{dia(n.fecha, diaCorto(en))}</span>
            {/* Barra clara: horas oscuras. Parte llena: lo que queda al descontar las nubes (el puntaje). */}
            <span className="relative h-2 overflow-hidden rounded-full bg-arena" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-full bg-violeta/25" style={{ width: `${(n.minutosOscuros / maximo) * 100}%` }} />
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${n === elegida ? "bg-gradient-to-r from-puna to-violeta" : "bg-violeta/60"}`}
                style={{ width: `${((cargando ? 0 : n.puntaje) / maximo) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-text-muted">
              {n.franja ? `${hora(n.franja.desde)}–${hora(n.franja.hasta)}` : en ? "Moonlit" : "con Luna"}
              <span className="sr-only">
                , {en ? "Moon at" : "Luna al"} {Math.round(n.lunaIluminada * 100)} %,
              </span>
            </span>
            <span className="col-span-2 col-start-2 text-right text-text-muted">
              {cargando ? (
                <span aria-hidden="true">…</span>
              ) : n.nubes === null ? (
                en ? "no cloud forecast" : "sin pronóstico de nubes"
              ) : (
                <>
                  {palabraDeNubes(n.nubes, en)} · <span className="tabular-nums">{porciento(n.nubes, en)}</span>
                  <span className="sr-only"> {en ? "cloud cover" : "de nubes"}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm leading-6 text-text-muted">
        {en
          ? "It counts as dark once twilight is over (Sun more than 18° below the horizon) and the Moon is down or almost new. "
          : "Cuenta como oscuro cuando terminó el crepúsculo (Sol a más de 18° bajo el horizonte) y la Luna no está arriba o está casi nueva. "}
        {pronostico.estado === "sin"
          ? en
            ? "Without a forecast the bar shows dark hours only: clouds and mountains aren't taken into account."
            : "Sin pronóstico, la barra muestra solo las horas oscuras: no se tienen en cuenta nubes ni cerros."
          : en
            ? "The light bar is each night's dark hours; the filled part is what's left after discounting the forecast cloud cover. Clouds come from a forecast, which can change, all the more for nights further away; the calculation still doesn't know about the mountains."
            : "La barra clara son las horas oscuras de cada noche; la parte llena, lo que queda al descontar la nubosidad prevista. Las nubes vienen de un pronóstico, que puede cambiar, más cuanto más lejos está la noche; el cálculo sigue sin conocer los cerros."}
      </p>
      {pronostico.estado === "sin" ? null : <CreditoOpenMeteo />}
    </div>
  );
}
