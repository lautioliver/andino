"use client";

import { useMemo } from "react";
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
  const momento = useMemo(() => {
    const m = mejorMomentoYacana(place, fecha);
    if (!m) return null;
    const local = aISOLocal(new Date(m.datetimeISO));
    return { ...m, fecha: local.slice(0, 10), hora: local.slice(11, 16) };
  }, [place, fecha]);

  return (
    <div className="mt-12">
      <p className="eyebrow text-text-muted">La llama del cielo andino</p>
      <p className="lead mt-4 text-text/85">
        En la Vía Láctea no solo hay figuras de estrellas: sus manchas oscuras también forman animales. Una de ellas es
        la <span className="text-sand">Yacana</span>, una llama que camina por el centro del cielo. Sus ojos son las dos
        estrellas brillantes que acompañan a la Cruz del Sur, α y β Centauri.
      </p>

      <blockquote className="mt-6 border-l-2 border-sand/60 pl-4">
        <p className="lead text-text/85">«… es una oscuridad del cielo».</p>
        <footer className="mt-2 text-sm leading-6 text-text-muted">
          Manuscrito de Huarochirí, hacia 1600. Traducción de José María Arguedas (1966).
        </footer>
      </blockquote>

      <p className="lead mt-6 text-text/85" aria-live="polite">
        {momento ? (
          <>
            Esta noche, el mejor momento para ver sus ojos es a las {momento.hora}
            {momento.hora < "12:00" ? ", de madrugada" : ""}: hacia el {rumbo(momento.az)},{" "}
            {describirAltura(momento.alt)}. Para ver la llama entera hace falta un cielo sin Luna y lejos de las luces.
          </>
        ) : (
          <>Esta noche sus ojos no suben con el cielo oscuro. Se ve mejor en las noches de otoño e invierno.</>
        )}
      </p>

      <p className="mt-4 text-sm leading-6 text-text-muted">
        Una tradición andina documentada en Perú y en el norte de Chile, en un cielo que también se ve desde Jujuy.
      </p>

      <LinkButton
        variant="ghost"
        href={`/cielo${queryCielo(place.id, momento ? { fecha: momento.fecha, hora: momento.hora } : null)}`}
        className="mt-6"
      >
        {momento ? "Ver el cielo a esa hora" : "Mirar el cielo"}
      </LinkButton>
    </div>
  );
}
