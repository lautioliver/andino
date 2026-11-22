"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SKY_OBJECT_INFO } from "@/data/astronomy";
import { buildDatetimeISO, queryCielo } from "@/features/cielo/cielo";
import { computeSky, type SkyObjectId, sunAltitudeDeg } from "@/features/cielo/motor";
import { SkyCanvas } from "@/features/cielo/SkyCanvas";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { useFechaDeLaNoche } from "./EstaNoche";
import { lineaDeLaNoche, TITULOS_EN } from "./linea";
import { HORA_NOCHE, nocheEn } from "./noche";

const hora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Jujuy",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const diaLargo = (lang: "es" | "en") => new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-AR", { timeZone: "America/Argentina/Jujuy", weekday: "long", day: "numeric", month: "long" });

/** Fondo de la portada: el cielo real de esta noche desde el lugar, quieto. Antes de hidratar, solo el azul noche. */
export function CieloDePortada({ place }: { place: AndinoPlace }) {
  const fecha = useFechaDeLaNoche();
  const cielo = useMemo(() => {
    if (!fecha) return null;
    const iso = buildDatetimeISO(fecha, HORA_NOCHE);
    const objetos = computeSky(place, iso).map((o) => ({ ...o, kind: SKY_OBJECT_INFO[o.id as SkyObjectId].kind }));
    return { iso, objetos, solAlt: sunAltitudeDeg(place, iso) };
  }, [place, fecha]);

  if (!cielo) return null;
  return (
    <SkyCanvas
      modo="fondo"
      location={place}
      datetimeISO={cielo.iso}
      solAlt={cielo.solAlt}
      objetos={cielo.objetos}
      selectedId={null}
      nombreLugar={place.name}
    />
  );
}

/** La noche contada de la puesta del sol al alba, con la conclusión práctica arriba. */
export function NocheEnLinea({ place }: { place: AndinoPlace }) {
  const fecha = useFechaDeLaNoche();
  const lang = useLang();
  const en = lang === "en";
  const datos = useMemo(
    () => (fecha ? { linea: lineaDeLaNoche(place, fecha), noche: nocheEn(place, fecha, lang) } : null),
    [place, fecha, lang],
  );

  // Mismo alto mientras calcula en el cliente: sin saltos.
  if (!datos || !datos.linea) return <div className="min-h-[22rem]" aria-busy />;
  const { linea, noche } = datos;

  const desde = linea.sinLuna ? hora.format(new Date(linea.sinLuna.desde)) : "";
  const hasta = linea.sinLuna ? hora.format(new Date(linea.sinLuna.hasta)) : "";
  const conclusion = linea.sinLuna
    ? en
      ? `Dark sky with no Moon from ${desde} to ${hasta}.`
      : `Cielo oscuro y sin Luna de ${desde} a ${hasta}.`
    : noche.luna.iluminada > 60
      ? en
        ? `${noche.luna.fase} all night: great for seeing the moonlit mountains, not so much the Milky Way.`
        : `${noche.luna.fase} toda la noche: ideal para ver los cerros iluminados, no tanto la Vía Láctea.`
      : en
        ? "The Moon is up for much of the night."
        : "La Luna acompaña buena parte de la noche.";

  return (
    <div>
      <p className="eyebrow text-text-muted first-letter:uppercase">{diaLargo(lang).format(new Date(`${fecha}T12:00:00-03:00`))}</p>
      <p className="headline mt-4 max-w-[22ch] text-[clamp(2rem,5vw,3.5rem)]">{conclusion}</p>

      <ol className="mt-10 md:mt-14 md:grid md:grid-flow-col md:auto-cols-fr md:gap-4">
        {linea.eventos.map((e) => {
          const luna = e.tipo.endsWith("luna");
          return (
            <li
              key={e.tipo}
              className="relative flex items-baseline justify-between gap-6 border-t border-border py-4 md:block md:rounded-card md:border md:bg-surface md:p-6 md:shadow-sm"
            >
              {/* Marca sobre el filete: arena para la Luna, celeste para el Sol y el cielo. */}
              <span aria-hidden className={`absolute top-6 right-6 hidden size-2 rounded-full md:block ${luna ? "bg-puna" : "bg-violeta"}`} />
              <span className="font-display order-2 text-3xl font-bold tracking-[-0.03em] tabular-nums md:text-4xl">{hora.format(new Date(e.iso))}</span>
              <span className={`order-1 text-sm md:mt-2 md:block ${luna ? "text-puna-ink" : "text-text-muted"}`}>{en ? TITULOS_EN[e.tipo] : e.titulo}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 max-w-[60ch] text-sm leading-6 text-text-muted">
        {en
          ? `Times calculated for ${place.name} with astronomical ephemerides. The calculation doesn't know about clouds or mountains: check the forecast before heading out.`
          : `Horas calculadas para ${place.name} con efemérides astronómicas. El cálculo no conoce las nubes ni los cerros: mirá el pronóstico antes de salir.`}
      </p>
      <Link href={`/cielo${queryCielo(place.id, { fecha: noche.fecha, hora: HORA_NOCHE })}`} className="link-arrow mt-4 text-violeta-ink">
        {en ? `See this sky at ${HORA_NOCHE}` : `Ver este cielo a las ${HORA_NOCHE}`}
      </Link>
    </div>
  );
}
