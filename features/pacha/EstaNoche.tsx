"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useLang } from "@/shared/i18n/lang";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { PasosStarlink } from "@/features/satelites/PasosStarlink";
import { MejorNoche } from "@/features/cuando/MejorNoche";
import { TuSigno } from "@/features/signo/TuSigno";
import { FiguraAndina } from "@/features/cielo/FiguraAndina";
import { fechaDeLaNoche, nocheEn, type Noche } from "./noche";

// La fecha depende del reloj del visitante: en el servidor (o al prerender) no hay "esta noche".
const sinSuscripcion = () => () => {};
export function useFechaDeLaNoche(): string | null {
  return useSyncExternalStore(
    sinSuscripcion,
    () => fechaDeLaNoche(new Date()),
    () => null,
  );
}

function useNoche(place: AndinoPlace): Noche | null {
  const fecha = useFechaDeLaNoche();
  const lang = useLang();
  return useMemo(() => (fecha ? nocheEn(place, fecha, lang) : null), [place, fecha, lang]);
}

/** Sección de la ficha: el segundo acto del lugar. */
export function EstaNoche({ place }: { place: AndinoPlace }) {
  const noche = useNoche(place);
  const en = useLang() === "en";

  return (
    <section aria-labelledby="esta-noche" className="rule mt-14 pt-6">
      <p className="eyebrow text-violeta-ink">{en ? "At night" : "De noche"}</p>
      <h2 id="esta-noche" className="headline mt-4 text-4xl md:text-5xl">
        {en ? `Tonight in ${place.name}` : `Esta noche en ${place.name}`}
      </h2>

      {!noche ? (
        <p className="lead mt-6 text-text-muted">{en ? "Calculating tonight’s sky…" : "Calculando el cielo de esta noche…"}</p>
      ) : (
        <>
          <MejorNoche place={place} fecha={noche.fecha} />

          <p className="eyebrow mt-12 text-text-muted">{en ? "Tonight" : "Esta noche"}</p>
          <p className="lead mt-4 text-text/85">
            {noche.puestaDeSol ? (en ? `The sun sets at ${noche.puestaDeSol}. ` : `El sol se pone a las ${noche.puestaDeSol}. `) : ""}
            {noche.visibles.length > 0
              ? en
                ? `At ${noche.hora}, from here, you'll be able to see:`
                : `A las ${noche.hora}, desde acá, vas a poder ver:`
              : en
                ? `At ${noche.hora} none of the objects we track is above the horizon.`
                : `A las ${noche.hora} ninguno de los objetos que seguimos está sobre el horizonte.`}
          </p>

          <ul className="mt-6">
            <li className="rule flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <span className="headline text-2xl">{noche.luna.fase}</span>
              <span className="text-sm text-text-muted">
                {noche.luna.visible
                  ? en
                    ? `${noche.luna.iluminada}% illuminated`
                    : `iluminada al ${noche.luna.iluminada}%`
                  : en
                    ? "not yet risen or already set at that time"
                    : "todavía no salió o ya se puso a esa hora"}
              </span>
            </li>
            {noche.visibles.map((o) => (
              <li key={o.id} className="rule flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="headline text-2xl">{o.name}</span>
                <span className="text-sm text-text-muted">{o.donde}</span>
              </li>
            ))}
          </ul>

          <PasosStarlink key={noche.fecha} placeId={place.id} fecha={noche.fecha} />

          <p className="mt-4 text-sm leading-6 text-text-muted">
            {en
              ? `Positions calculated for ${place.name} with astronomical ephemerides. They don't account for the mountains of the quebrada or for clouds: anything very low may be hidden.`
              : `Posiciones calculadas para ${place.name} con efemérides astronómicas. No tienen en cuenta los cerros de la quebrada ni las nubes: lo que está muy bajo puede quedar tapado.`}
          </p>

          <LinkButton variant="violeta" href={noche.href} className="mt-8">
            {en ? "See the full sky" : "Mirar el cielo completo"}
          </LinkButton>

          <TuSigno place={place} fecha={noche.fecha} />
          <FiguraAndina place={place} fecha={noche.fecha} />
        </>
      )}
    </section>
  );
}
