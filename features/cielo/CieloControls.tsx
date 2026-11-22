import { places } from "@/data/places";
import type { PlaceId } from "@/shared/types";
import { HORA_EJEMPLO } from "./cielo";

// Campos de Abra: caja blanca, borde suave, radio 8px.
const campo = "mt-2 min-h-12 w-full rounded-control border border-border bg-surface px-3 text-base text-text shadow-sm focus:border-violeta";

export function LocationSelector({
  value,
  onChange,
}: {
  value: PlaceId | null;
  onChange: (id: PlaceId) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-text-muted">Lugar</span>
      <select
        className={`${campo} appearance-none`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as PlaceId)}
      >
        {value === null && (
          <option value="" disabled>
            Elegí un lugar
          </option>
        )}
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateTimePicker({
  fecha,
  hora,
  esEjemplo,
  onChange,
}: {
  fecha: string;
  hora: string;
  esEjemplo: boolean;
  onChange: (fecha: string, hora: string) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow text-text-muted">Fecha y hora · Argentina, UTC−3</legend>
      <div className="mt-1 grid gap-6 min-[360px]:grid-cols-2">
        <input
          type="date"
          aria-label="Fecha"
          className={campo}
          value={fecha}
          onChange={(e) => onChange(e.target.value, hora)}
        />
        <input
          type="time"
          aria-label="Hora"
          className={campo}
          value={hora}
          onChange={(e) => onChange(fecha, e.target.value)}
        />
      </div>
      {esEjemplo && (
        <p className="mt-3 text-sm text-puna-ink">
          Ejemplo: hoy a las {HORA_EJEMPLO}. Cambialo para ver otro momento.
        </p>
      )}
    </fieldset>
  );
}
