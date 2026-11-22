"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AndinoPlace } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { PasosStarlink } from "@/features/satelites/PasosStarlink";
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
  return useMemo(() => (fecha ? nocheEn(place, fecha) : null), [place, fecha]);
}

function lista(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/** Sección de la ficha: el segundo acto del lugar. */
export function EstaNoche({ place }: { place: AndinoPlace }) {
  const noche = useNoche(place);

  return (
    <section aria-labelledby="esta-noche" className="rule mt-14 pt-6">
      <p className="eyebrow text-sky">De noche</p>
      <h2 id="esta-noche" className="headline mt-4 text-4xl md:text-5xl">
        Esta noche en {place.name}
      </h2>

      {!noche ? (
        <p className="lead mt-6 text-text-muted">Calculando el cielo de esta noche…</p>
      ) : (
        <>
          <p className="lead mt-6 text-text/85">
            {noche.puestaDeSol ? `El sol se pone a las ${noche.puestaDeSol}. ` : ""}
            {noche.visibles.length > 0
              ? `A las ${noche.hora}, desde acá, vas a poder ver:`
              : `A las ${noche.hora} ninguno de los objetos que seguimos está sobre el horizonte.`}
          </p>

          <ul className="mt-6">
            <li className="rule flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <span className="headline text-2xl">{noche.luna.fase}</span>
              <span className="text-sm text-text-muted">
                {noche.luna.visible ? `iluminada al ${noche.luna.iluminada}%` : "todavía no salió o ya se puso a esa hora"}
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
            Posiciones calculadas para {place.name} con efemérides astronómicas. No tienen en cuenta los cerros de la
            quebrada ni las nubes: lo que está muy bajo puede quedar tapado.
          </p>

          <LinkButton variant="sky" href={noche.href} className="mt-8">
            Mirar el cielo completo
          </LinkButton>
        </>
      )}
    </section>
  );
}

/** Una línea para las tarjetas de destinos del Inicio. */
export function NocheBreve({ place }: { place: AndinoPlace }) {
  const noche = useNoche(place);
  if (!noche) return <p className="mt-2 min-h-5 text-sm text-sky/80">&nbsp;</p>;
  const nombres = noche.visibles.slice(0, 2).map((o) => o.name.replace(/ \(.*\)$/, ""));
  const partes = [noche.luna.visible ? noche.luna.fase : null, ...nombres].filter((s): s is string => Boolean(s));
  return (
    <p className="mt-2 min-h-5 text-sm text-sky">
      {partes.length > 0 ? `Esta noche: ${lista(partes)}` : "Esta noche: mirá su cielo"}
    </p>
  );
}

/** Portada del Inicio: la respuesta de esta noche en tres datos, calculada en el teléfono. */
export function NocheHero({ place }: { place: AndinoPlace }) {
  const noche = useNoche(place);
  const nombres = noche?.visibles.slice(0, 2).map((o) => o.name.replace(/ \(.*\)$/, "")) ?? [];
  const datos = noche
    ? [
        { valor: noche.puestaDeSol ?? "—", texto: "se pone el sol" },
        { valor: `${noche.luna.iluminada}%`, texto: noche.luna.fase.toLowerCase() },
        { valor: noche.hora, texto: nombres.length ? `${lista(nombres)} a la vista` : "mirá su cielo" },
      ]
    : null;

  return (
    <section aria-labelledby="noche-hero" className="rule max-w-[640px] pt-4">
      <h2 id="noche-hero" className="eyebrow text-sky">
        Esta noche en {place.name}
      </h2>
      {/* Alto fijo: sin salto de diseño mientras se calcula en el cliente. */}
      <dl className="mt-4 grid min-h-[4.5rem] grid-cols-3 gap-4 sm:gap-8">
        {(datos ?? [0, 1, 2].map(() => ({ valor: " ", texto: " " }))).map((d, i) => (
          <div key={i}>
            <dt className="sr-only">{d.texto}</dt>
            <dd className="headline text-2xl tabular-nums sm:text-4xl">{d.valor}</dd>
            <dd className="mt-1 text-xs leading-4 text-text/75 sm:text-sm">{d.texto}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
