import type { SkyObjectInfo } from "@/data/astronomy";
import type { SkyObject } from "@/shared/types";
import { describirAltura, rumbo } from "./cielo";

const grados = (valor: number) => `${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}°`;

export function CelestialObjectCard({ object, info }: { object: SkyObject; info: SkyObjectInfo }) {
  return (
    <article className="rounded-card border border-border bg-surface p-4" aria-live="polite">
      <p className="text-xs tracking-wide text-sky uppercase">{info.kind}</p>
      <h2 className="mt-1 font-display text-[22px] leading-7 font-bold">{object.name}</h2>

      {object.isAboveHorizon ? (
        <p className="mt-2">
          Hacia el <strong>{rumbo(object.azimuthDeg)}</strong>, {describirAltura(object.altitudeDeg)}.
        </p>
      ) : (
        <p className="mt-2">No se ve a esta hora: está bajo el horizonte.</p>
      )}
      <p className="mt-1 text-sm text-text-muted">
        Altitud {grados(object.altitudeDeg)} · Acimut {grados(object.azimuthDeg)}
      </p>

      <p className="mt-3 max-w-[65ch] text-text-muted">{info.summary}</p>

      <p className="mt-3 text-sm text-text-muted">
        Fuente:{" "}
        {info.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer" className="text-sky underline underline-offset-2">
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </article>
  );
}
