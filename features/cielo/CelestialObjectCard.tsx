"use client";

import type { SkyObjectInfo } from "@/data/astronomy";
import { Escuchar } from "@/features/escuchar/Escuchar";
import { useLang } from "@/shared/i18n/lang";
import type { SkyObject } from "@/shared/types";
import { describirAltura, rumbo } from "./cielo";

export function CelestialObjectCard({ object, info }: { object: SkyObject; info: SkyObjectInfo }) {
  const lang = useLang();
  const en = lang === "en";
  const grados = (valor: number) => `${valor.toLocaleString(en ? "en-US" : "es-AR", { maximumFractionDigits: 1 })}°`;
  return (
    <article className="card p-5 md:p-6" aria-live="polite" data-escuchable>
      {/* Se lee el tipo, el nombre, hacia dónde está y la explicación: ni las cifras ni la fuente. */}
      <div className="flex min-h-11 items-center justify-between gap-4">
        <p className="eyebrow text-violeta-ink" data-leer>
          {en ? info.en.kind : info.kind}
        </p>
        <Escuchar clave={object.id} />
      </div>
      <h2 className="display mt-3 text-4xl md:text-5xl" data-leer>
        {en ? info.en.name : object.name}
      </h2>

      {object.isAboveHorizon ? (
        <p className="lead mt-4" data-leer>
          {en ? "To the " : "Hacia el "}
          <strong>{rumbo(object.azimuthDeg, lang)}</strong>, {describirAltura(object.altitudeDeg, lang)}.
        </p>
      ) : (
        <p className="lead mt-4" data-leer>
          {en ? "Not visible at this time: it is below the horizon." : "No se ve a esta hora: está bajo el horizonte."}
        </p>
      )}
      <p className="mt-2 text-sm text-text-muted tabular-nums">
        {en ? "Altitude" : "Altitud"} {grados(object.altitudeDeg)} · {en ? "Azimuth" : "Acimut"} {grados(object.azimuthDeg)}
      </p>

      <p className="mt-5 max-w-[65ch] leading-7 text-text/85" data-leer>
        {en ? info.en.summary : info.summary}
      </p>

      <p className="mt-5 text-sm text-text-muted">
        {en ? "Source: " : "Fuente: "}
        {info.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-4 hover:decoration-violeta">
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </article>
  );
}
