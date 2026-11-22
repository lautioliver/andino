"use client";

import { places } from "@/data/places";
import { useT } from "@/shared/i18n/lang";
import type { PlaceId } from "@/shared/types";

// Campos de Abra: caja blanca, borde suave, radio 8px.
const campo = "mt-2 min-h-12 w-full rounded-control border border-border bg-surface px-3 text-base text-text shadow-sm focus:border-violeta";

const textos = {
  es: {
    lugar: "Lugar",
    elegir: "Elegí un lugar",
    aqui: "Mi ubicación",
    paradas: "Paradas del Tren Solar",
    momento: "Fecha y hora · Argentina, UTC−3",
    fecha: "Fecha",
    hora: "Hora",
    vivo: "Ahora, en vivo: el cielo sigue al reloj. Cambiá la fecha o la hora para ver otro momento.",
    ahora: "Volver a ahora",
  },
  en: {
    lugar: "Place",
    elegir: "Choose a place",
    aqui: "My location",
    paradas: "Solar Train stops",
    momento: "Date and time · Argentina, UTC−3",
    fecha: "Date",
    hora: "Time",
    vivo: "Live, right now: the sky follows the clock. Change the date or time to see another moment.",
    ahora: "Back to now",
  },
};

/** "aqui" es la ubicación del teléfono; el resto, las paradas. */
export type LugarElegido = PlaceId | "aqui";

export function LocationSelector({
  value,
  onChange,
  conUbicacion,
}: {
  value: LugarElegido | null;
  onChange: (id: LugarElegido) => void;
  /** Muestra «Mi ubicación» si el teléfono puede dar su posición. */
  conUbicacion: boolean;
}) {
  const t = useT(textos);
  return (
    <label className="block">
      <span className="eyebrow text-text-muted">{t.lugar}</span>
      <select className={`${campo} appearance-none`} value={value ?? ""} onChange={(e) => onChange(e.target.value as LugarElegido)}>
        {value === null && (
          <option value="" disabled>
            {t.elegir}
          </option>
        )}
        {conUbicacion && <option value="aqui">{t.aqui}</option>}
        <optgroup label={t.paradas}>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

export function DateTimePicker({
  fecha,
  hora,
  enVivo,
  onChange,
  onAhora,
}: {
  fecha: string;
  hora: string;
  enVivo: boolean;
  onChange: (fecha: string, hora: string) => void;
  onAhora: () => void;
}) {
  const t = useT(textos);
  return (
    <fieldset>
      <legend className="eyebrow text-text-muted">{t.momento}</legend>
      <div className="mt-1 grid gap-6 min-[360px]:grid-cols-2">
        <input type="date" aria-label={t.fecha} className={campo} value={fecha} onChange={(e) => onChange(e.target.value, hora)} />
        <input type="time" aria-label={t.hora} className={campo} value={hora} onChange={(e) => onChange(fecha, e.target.value)} />
      </div>
      {enVivo ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-success">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-success" />
          {t.vivo}
        </p>
      ) : (
        <button type="button" onClick={onAhora} className="link-arrow mt-2 text-sm text-violeta-ink">
          {t.ahora}
        </button>
      )}
    </fieldset>
  );
}
