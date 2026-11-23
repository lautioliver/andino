"use client";

import Link from "next/link";
import { useMemo } from "react";
import { queryCielo } from "@/features/cielo/cielo";
import { useFechaDeLaNoche } from "@/features/pacha/EstaNoche";
import { lineaDeLaNoche, TITULOS_EN } from "@/features/pacha/linea";
import { HORA_NOCHE, nocheEn } from "@/features/pacha/noche";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { Avisame } from "./Avisame";
import { hora as horaDeCuando, nocheDeCielo, titularDeLaNoche, ventanaDeNubes } from "./cuando";
import { CreditoOpenMeteo, palabraDeNubes, porciento, useNubes } from "./Nubes";

const hora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Jujuy",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const diaLargo = (lang: "es" | "en") => new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-AR", { timeZone: "America/Argentina/Jujuy", weekday: "long", day: "numeric", month: "long" });

/**
 * «La noche en <lugar>» de la portada: la noche contada de la puesta del sol al alba, con la conclusión
 * práctica arriba, las nubes previstas y el recordatorio para esta noche. Parte de NocheEnLinea
 * (features/pacha/Portada.tsx) y le suma el pronóstico y «Avisame esta noche».
 */
export function NocheDePortada({ place }: { place: AndinoPlace }) {
  const fecha = useFechaDeLaNoche();
  const lang = useLang();
  const en = lang === "en";
  const pronostico = useNubes(place.id);
  const datos = useMemo(
    () => (fecha ? { linea: lineaDeLaNoche(place, fecha), noche: nocheEn(place, fecha, lang) } : null),
    [place, fecha, lang],
  );
  // La misma noche con el motor de «Cuándo»: de ahí salen el titular, las horas de las nubes y el recordatorio.
  const cielo = useMemo(() => (fecha ? nocheDeCielo(place, fecha, pronostico.nubes) : null), [place, fecha, pronostico.nubes]);

  // Las horas del titular son las de la franja de «Cuándo», al minuto: las mismas de la línea de tiempo de abajo.
  const titular = datos && cielo ? titularDeLaNoche(cielo, datos.noche.luna, en) : null;

  // Mismo alto mientras calcula en el cliente: sin saltos. También si esa noche no llega a oscurecer.
  if (!datos || !datos.linea || !cielo || !titular) return <div className="min-h-[22rem]" aria-busy />;
  const { linea, noche } = datos;

  // Las nubes se miran en la franja oscura; si la Luna no deja franja, en toda la noche cerrada.
  const ventana = ventanaDeNubes(cielo);
  const horasDeNubes = ventana
    ? en
      ? `from ${horaDeCuando(ventana.desde)} to ${horaDeCuando(ventana.hasta)}`
      : `de ${horaDeCuando(ventana.desde)} a ${horaDeCuando(ventana.hasta)}`
    : "";

  return (
    <div>
      <p className="eyebrow text-text-muted first-letter:uppercase">{diaLargo(lang).format(new Date(`${fecha}T12:00:00-03:00`))}</p>
      <p className="headline mt-4 max-w-[22ch] text-[clamp(2rem,5vw,3.5rem)]">{titular.texto}</p>
      <p className="lead mt-4 text-text/85" aria-live="polite">
        {pronostico.estado === "cargando" ? (
          <span className="text-text-muted">{en ? "Checking the cloud forecast…" : "Buscando el pronóstico de nubes…"}</span>
        ) : cielo.nubes === null ? (
          <span className="text-text-muted">{en ? "No cloud forecast for tonight right now." : "Ahora no hay pronóstico de nubes para esta noche."}</span>
        ) : (
          <>
            {titular.conFranja ? (en ? "Clouds during those hours" : "Nubes en esas horas") : en ? `Clouds ${horasDeNubes}` : `Nubes ${horasDeNubes}`}:{" "}
            <span className="text-violeta-ink">{palabraDeNubes(cielo.nubes, en)}</span> ({porciento(cielo.nubes, en)}).
          </>
        )}
      </p>

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

      {pronostico.estado === "sin" ? (
        // Sin pronóstico, el aviso de siempre: acá no hay nubes que atribuirle a nadie.
        <p className="mt-8 max-w-[60ch] text-sm leading-6 text-text-muted">
          {en
            ? `Times calculated for ${place.name} with astronomical ephemerides. Right now the calculation doesn't know about clouds or mountains: check a forecast before heading out.`
            : `Horas calculadas para ${place.name} con efemérides astronómicas. Ahora el cálculo no conoce las nubes ni los cerros: mirá un pronóstico antes de salir.`}
        </p>
      ) : (
        <>
          <p className="mt-8 max-w-[60ch] text-sm leading-6 text-text-muted">
            {en
              ? `Times calculated for ${place.name} with astronomical ephemerides. Clouds come from a forecast, which can change: check it again before heading out. The calculation still doesn't know about the mountains.`
              : `Horas calculadas para ${place.name} con efemérides astronómicas. Las nubes vienen de un pronóstico, que puede cambiar: volvé a mirarlo antes de salir. El cálculo sigue sin conocer los cerros.`}
          </p>
          <CreditoOpenMeteo />
        </>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3">
        <Avisame placeId={place.id} noche={cielo} esHoy />
        <Link href={`/cielo${queryCielo(place.id, { fecha: noche.fecha, hora: HORA_NOCHE })}`} className="link-arrow min-h-12 text-violeta-ink">
          {en ? `See this sky at ${HORA_NOCHE}` : `Ver este cielo a las ${HORA_NOCHE}`}
        </Link>
      </div>
    </div>
  );
}
