// Horas del día y la noche para un lugar: ocaso, crepúsculos, noche cerrada, amanecer y Luna.
// Lógica pura (sin DOM). Propiedad: jehp23.
import {
  AstroTime,
  Body,
  Equator,
  Horizon,
  Illumination,
  MakeTime,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from "astronomy-engine";
// Sin imports de valor relativos: los tests corren este .ts directo con node (ver motor.test.mjs).
import type { SkyLocation } from "./motor";

/** Las horas se muestran en la de Argentina (UTC−3, sin horario de verano). */
const OFFSET_MS = -3 * 3600_000;

export type Momento = "dia" | "atardecer" | "noche";

/** Altitud del Sol que separa el atardecer de la noche (crepúsculo náutico). */
export const UMBRAL_NOCHE = -12;

/** Fechas ISO en UTC−3 ("2026-11-22T19:48:58-03:00"); null si el evento no ocurre. */
export interface Jornada {
  /** El Sol cruza el horizonte (con refracción y semidiámetro), la tarde de la fecha. */
  ocaso: string | null;
  /** Sol a −6°: aparecen las estrellas más brillantes. */
  finCivil: string | null;
  /** Sol a −18°: termina el crepúsculo astronómico. */
  nocheCerrada: string | null;
  /** Salida del Sol a la mañana siguiente. */
  amanecer: string | null;
  luna: {
    /** Primera salida de la Luna desde el mediodía de la fecha (puede ser de tarde). */
    sale: string | null;
    /** Primera puesta de la Luna desde el mediodía de la fecha. */
    sePone: string | null;
    /** Fracción iluminada (0 a 1) a la hora de la noche cerrada. */
    iluminada: number;
  };
}

function observador(location: SkyLocation): Observer {
  return new Observer(location.latitude, location.longitude, location.heightMeters ?? 0);
}

/** AstroTime → ISO con offset −03:00, al segundo. */
export function aISOLocal(fecha: Date): string {
  return `${new Date(fecha.getTime() + OFFSET_MS).toISOString().slice(0, 19)}-03:00`;
}

function iso(t: AstroTime | null): string | null {
  return t ? aISOLocal(t.date) : null;
}

/** "HH:MM" en UTC−3, redondeado al minuto. */
export function horaLocal(datetimeISO: string): string {
  const ms = new Date(datetimeISO).getTime() + OFFSET_MS;
  return new Date(Math.round(ms / 60_000) * 60_000).toISOString().slice(11, 16);
}

/**
 * La tarde y la noche de una fecha ("2026-11-22"), buscando desde el mediodía local.
 * Sin depresión del horizonte por altura: en la Quebrada los cerros tapan antes.
 */
export function jornada(location: SkyLocation, fecha: string): Jornada {
  const obs = observador(location);
  const mediodia = MakeTime(new Date(`${fecha}T12:00:00-03:00`));

  const ocaso = SearchRiseSet(Body.Sun, obs, -1, mediodia, 1);
  const finCivil = SearchAltitude(Body.Sun, obs, -1, mediodia, 1, -6);
  const nocheCerrada = SearchAltitude(Body.Sun, obs, -1, mediodia, 1, -18);
  const amanecer = SearchRiseSet(Body.Sun, obs, +1, mediodia, 1);

  const referencia = nocheCerrada ?? mediodia.AddDays(10 / 24);
  return {
    ocaso: iso(ocaso),
    finCivil: iso(finCivil),
    nocheCerrada: iso(nocheCerrada),
    amanecer: iso(amanecer),
    luna: {
      sale: iso(SearchRiseSet(Body.Moon, obs, +1, mediodia, 1)),
      sePone: iso(SearchRiseSet(Body.Moon, obs, -1, mediodia, 1)),
      iluminada: Illumination(Body.Moon, referencia).phase_fraction,
    },
  };
}

/** Altitud geométrica del Sol (sin refracción), como `sunAltitudeDeg` del motor. */
function altitudSol(location: SkyLocation, datetimeISO: string): number {
  const time = MakeTime(new Date(datetimeISO));
  const obs = observador(location);
  const eq = Equator(Body.Sun, time, obs, true, true);
  return Horizon(time, obs, eq.ra, eq.dec).altitude;
}

/**
 * Día (Sol > 0°), atardecer (0° a −12°) o noche (< −12°).
 * El alba también cae en «atardecer»: misma luz, el Sol subiendo.
 */
export function momento(location: SkyLocation, datetimeISO: string): Momento {
  const alt = altitudSol(location, datetimeISO);
  if (alt > 0) return "dia";
  if (alt >= UMBRAL_NOCHE) return "atardecer";
  return "noche";
}
