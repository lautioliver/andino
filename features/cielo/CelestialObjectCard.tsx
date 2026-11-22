import type { SkyObjectInfo } from "@/data/astronomy";
import type { SkyObject } from "@/shared/types";
import { describirAltura, rumbo } from "./cielo";

const grados = (valor: number) => `${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}°`;

export function CelestialObjectCard({ object, info }: { object: SkyObject; info: SkyObjectInfo }) {
  return (
    <article className="card p-5 md:p-6" aria-live="polite">
      <p className="eyebrow text-violeta-ink">{info.kind}</p>
      <h2 className="display mt-3 text-4xl md:text-5xl">{object.name}</h2>

      {object.isAboveHorizon ? (
        <p className="lead mt-4">
          Hacia el <strong>{rumbo(object.azimuthDeg)}</strong>, {describirAltura(object.altitudeDeg)}.
        </p>
      ) : (
        <p className="lead mt-4">No se ve a esta hora: está bajo el horizonte.</p>
      )}
      <p className="mt-2 text-sm text-text-muted tabular-nums">
        Altitud {grados(object.altitudeDeg)} · Acimut {grados(object.azimuthDeg)}
      </p>

      <p className="mt-5 max-w-[65ch] leading-7 text-text/85">{info.summary}</p>

      <p className="mt-5 text-sm text-text-muted">
        Fuente:{" "}
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
