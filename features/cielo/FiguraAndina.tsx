"use client";

import { useMemo } from "react";
import { Escuchar } from "@/features/escuchar/Escuchar";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { mejorMomentoYacana } from "./andino";
import { describirAltura, queryCielo, rumbo } from "./cielo";
import { aISOLocal } from "./jornada";

/**
 * La Yacana, la llama del cielo andino, en la ficha: qué es y cuándo ver sus ojos esta noche.
 * Fuentes y qué se puede afirmar: docs/fuentes-cielo-andino.md.
 */
export function FiguraAndina({ place, fecha }: { place: AndinoPlace; fecha: string }) {
  const lang = useLang();
  const en = lang === "en";
  const momento = useMemo(() => {
    const m = mejorMomentoYacana(place, fecha);
    if (!m) return null;
    const local = aISOLocal(new Date(m.datetimeISO));
    return { ...m, fecha: local.slice(0, 10), hora: local.slice(11, 16) };
  }, [place, fecha]);

  return (
    <div className="mt-12" data-escuchable>
      {/* Se lee el título y la explicación: ni la cita ni su fuente. */}
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="eyebrow text-text-muted" data-leer>
          {en ? "The llama of the Andean sky" : "La llama del cielo andino"}
        </p>
        <Escuchar clave={`${place.id} ${fecha}`} />
      </div>
      <p className="lead mt-4 text-text/85" data-leer>
        {en ? (
          <>
            The Milky Way doesn&apos;t only hold star figures: its dark patches form animals too. One of them is the{" "}
            <span className="text-puna-ink">Yacana</span>, a llama walking across the middle of the sky. Its eyes are the two
            bright stars next to the Southern Cross, α and β Centauri.
          </>
        ) : (
          <>
            En la Vía Láctea no solo hay figuras de estrellas: sus manchas oscuras también forman animales. Una de ellas es
            la <span className="text-puna-ink">Yacana</span>, una llama que camina por el centro del cielo. Sus ojos son las
            dos estrellas brillantes que acompañan a la Cruz del Sur, α y β Centauri.
          </>
        )}
      </p>

      <blockquote className="mt-6 border-l-2 border-puna/60 pl-4">
        <p className="lead text-text/85">{en ? "“… it is a darkness of the sky.”" : "«… es una oscuridad del cielo»."}</p>
        <footer className="mt-2 text-sm leading-6 text-text-muted">
          {en
            ? "Huarochirí Manuscript, c. 1600. Spanish translation by José María Arguedas (1966)."
            : "Manuscrito de Huarochirí, hacia 1600. Traducción de José María Arguedas (1966)."}
        </footer>
      </blockquote>

      <p className="lead mt-6 text-text/85" aria-live="polite" data-leer>
        {momento
          ? en
            ? `Tonight, the best time to see its eyes is at ${momento.hora}${momento.hora < "12:00" ? ", before dawn" : ""}: to the ${rumbo(momento.az, lang)}, ${describirAltura(momento.alt, lang)}. To see the whole llama you need a moonless sky far from lights.`
            : `Esta noche, el mejor momento para ver sus ojos es a las ${momento.hora}${momento.hora < "12:00" ? ", de madrugada" : ""}: hacia el ${rumbo(momento.az)}, ${describirAltura(momento.alt)}. Para ver la llama entera hace falta un cielo sin Luna y lejos de las luces.`
          : en
            ? "Tonight its eyes don't rise while the sky is dark. It's best seen on autumn and winter nights."
            : "Esta noche sus ojos no suben con el cielo oscuro. Se ve mejor en las noches de otoño e invierno."}
      </p>

      <p className="mt-4 text-sm leading-6 text-text-muted" data-leer>
        {en
          ? "An Andean tradition documented in Peru and northern Chile, in a sky that can also be seen from Jujuy."
          : "Una tradición andina documentada en Perú y en el norte de Chile, en un cielo que también se ve desde Jujuy."}
      </p>

      <LinkButton
        variant="ghost"
        href={`/cielo${queryCielo(place.id, momento ? { fecha: momento.fecha, hora: momento.hora } : null)}`}
        className="mt-6"
      >
        {momento ? (en ? "See the sky at that time" : "Ver el cielo a esa hora") : en ? "Look at the sky" : "Mirar el cielo"}
      </LinkButton>
    </div>
  );
}
