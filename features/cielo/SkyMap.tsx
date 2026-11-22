import type { SkyObjectKind } from "@/data/astronomy";
import type { SkyObject } from "@/shared/types";
import { proyectarEnDomo } from "./cielo";

const RADIO = 110;
const MARGEN = 22;
const LADO = RADIO + MARGEN;

const tamanio: Record<SkyObjectKind, number> = { satélite: 8, planeta: 5.5, estrella: 4 };
const relleno: Record<SkyObjectKind, string> = { satélite: "fill-sand", planeta: "fill-sky", estrella: "fill-text" };

// Este a la izquierda: es un mapa para mirar hacia arriba (ver proyectarEnDomo).
const CARDINALES = [
  { label: "N", az: 0 },
  { label: "E", az: 90 },
  { label: "S", az: 180 },
  { label: "O", az: 270 },
];

interface Props {
  objects: (SkyObject & { kind: SkyObjectKind })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Mapa 2D esquemático del domo celeste. Solo dibuja los objetos sobre el horizonte.
 * Es decorativo para lectores de pantalla: la lista de objetos es el control accesible.
 */
export function SkyMap({ objects, selectedId, onSelect }: Props) {
  const visibles = objects.filter((o) => o.isAboveHorizon);

  return (
    <svg
      viewBox={`${-LADO} ${-LADO} ${LADO * 2} ${LADO * 2}`}
      className="mx-auto block w-full max-w-[420px] touch-manipulation select-none"
      aria-hidden="true"
    >
      <circle r={RADIO} className="fill-surface stroke-border" strokeWidth={1.5} />
      {[30, 60].map((alt) => (
        <circle
          key={alt}
          r={((90 - alt) / 90) * RADIO}
          className="fill-none stroke-border"
          strokeWidth={0.75}
          strokeDasharray="3 4"
        />
      ))}
      <circle r={1.5} className="fill-text-muted" />

      {CARDINALES.map(({ label, az }) => {
        const p = proyectarEnDomo(-12, az, RADIO);
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-text-muted font-sans text-[11px] font-medium"
          >
            {label}
          </text>
        );
      })}

      {visibles.map((o) => {
        const p = proyectarEnDomo(o.altitudeDeg, o.azimuthDeg, RADIO);
        const seleccionado = o.id === selectedId;
        const etiquetaALaIzquierda = p.x > RADIO * 0.45;
        const separacion = tamanio[o.kind] + (seleccionado ? 9 : 5);
        return (
          // Atajo táctil: el control accesible es la lista de objetos.
          <g
            key={o.id}
            transform={`translate(${p.x} ${p.y})`}
            onClick={() => onSelect(o.id)}
            className="cursor-pointer"
          >
            {/* Área táctil de ~44 px en un mapa de 360 px de ancho. */}
            <circle r={20} className="fill-transparent" />
            {seleccionado && <circle r={tamanio[o.kind] + 5} className="fill-none stroke-text" strokeWidth={1.5} />}
            <circle r={tamanio[o.kind]} className={relleno[o.kind]} />
            <text
              x={etiquetaALaIzquierda ? -separacion : separacion}
              textAnchor={etiquetaALaIzquierda ? "end" : "start"}
              dominantBaseline="central"
              className={`font-sans text-[11px] ${seleccionado ? "fill-text font-semibold" : "fill-text-muted"}`}
            >
              {o.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
