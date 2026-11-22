// «Cuándo»: de las noches de tu viaje, cuál tiene más cielo oscuro.
// Una noche cuenta como oscura mientras el Sol está a más de 18° bajo el horizonte (terminó el
// crepúsculo astronómico) y la Luna no está arriba, o es tan fina que casi no ilumina.
//
// Lógica pura, sin DOM ni imports relativos de valor: los tests corren este .ts directo con node.
import { Body, Equator, Horizon, Illumination, MakeTime, Observer } from "astronomy-engine";

/** Se muestran las horas en la de Argentina (UTC−3, sin horario de verano). */
const OFFSET_MS = -3 * 3600_000;
/** Resolución del barrido de la noche. */
export const PASO_MIN = 5;
/** Sol más bajo que esto: terminó el crepúsculo astronómico. */
export const SOL_NOCHE = -18;
/** Debajo de esta fracción iluminada, la Luna no arruina el cielo aunque esté arriba. */
export const LUNA_FINA = 0.1;

export interface Lugar {
  latitude: number;
  longitude: number;
}

export interface Franja {
  /** ISO con offset −03:00. */
  desde: string;
  hasta: string;
}

export interface NocheDeCielo {
  /** YYYY-MM-DD de la tarde en que empieza la noche. */
  fecha: string;
  /** Sol a −18° de tarde y de madrugada; null si esa noche no llega a oscurecer del todo. */
  nocheCerrada: string | null;
  alba: string | null;
  /** Fracción iluminada de la Luna (0 a 1) a la medianoche. */
  lunaIluminada: number;
  /** Minutos con Sol bajo −18° y sin Luna que moleste. */
  minutosOscuros: number;
  /** El tramo oscuro más largo de la noche. */
  franja: Franja | null;
}

function aISOLocal(ms: number): string {
  return `${new Date(ms + OFFSET_MS).toISOString().slice(0, 19)}-03:00`;
}

/** "HH:MM" de una hora ISO, en UTC−3. */
export function hora(datetimeISO: string): string {
  return new Date(new Date(datetimeISO).getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** Altitud del Sol sin refracción (como jornada.ts y motor.ts); la de la Luna, con refracción. */
function altitud(body: Body, ms: number, obs: Observer): number {
  const time = MakeTime(new Date(ms));
  const eq = Equator(body, time, obs, true, true);
  return Horizon(time, obs, eq.ra, eq.dec, body === Body.Moon ? "normal" : undefined).altitude;
}

/**
 * El tramo seguido de `true` más largo, como índices [desde, hasta); el primero si empatan.
 * En Jujuy la Luna sale o se pone una sola vez por noche oscura, pero no lo damos por hecho.
 */
export function tramoMasLargo(muestras: boolean[]): { desde: number; hasta: number } | null {
  let mejor: { desde: number; hasta: number } | null = null;
  let desde: number | null = null;
  for (let i = 0; i <= muestras.length; i++) {
    if (muestras[i]) {
      desde ??= i;
    } else if (desde !== null) {
      if (!mejor || i - desde > mejor.hasta - mejor.desde) mejor = { desde, hasta: i };
      desde = null;
    }
  }
  return mejor;
}

/** Recorre la noche de `fecha` (de 18:00 a 08:00 del día siguiente) cada PASO_MIN minutos. */
export function nocheDeCielo(lugar: Lugar, fecha: string): NocheDeCielo {
  const obs = new Observer(lugar.latitude, lugar.longitude, 0);
  const inicio = new Date(`${fecha}T18:00:00-03:00`).getTime();
  const fin = inicio + 14 * 3600_000;
  const paso = PASO_MIN * 60_000;
  const lunaIluminada = Illumination(Body.Moon, MakeTime(new Date(inicio + 6 * 3600_000))).phase_fraction;
  const lunaFina = lunaIluminada < LUNA_FINA;

  const muestras: { t: number; esNoche: boolean; oscuro: boolean }[] = [];
  for (let t = inicio; t < fin; t += paso) {
    const esNoche = altitud(Body.Sun, t, obs) < SOL_NOCHE;
    const oscuro = esNoche && (lunaFina || altitud(Body.Moon, t, obs) < 0);
    muestras.push({ t, esNoche, oscuro });
  }
  const noche = muestras.filter((m) => m.esNoche);
  const primeraNoche = noche.at(0)?.t ?? null;
  const ultimaNoche = noche.at(-1)?.t ?? null;
  const tramo = tramoMasLargo(muestras.map((m) => m.oscuro));
  const mejor = tramo ? { desde: inicio + tramo.desde * paso, hasta: inicio + tramo.hasta * paso } : null;
  const oscuros = muestras.filter((m) => m.oscuro).length * PASO_MIN;

  return {
    fecha,
    nocheCerrada: primeraNoche === null ? null : aISOLocal(primeraNoche),
    alba: ultimaNoche === null ? null : aISOLocal(ultimaNoche + paso),
    lunaIluminada,
    minutosOscuros: oscuros,
    franja: mejor ? { desde: aISOLocal(mejor.desde), hasta: aISOLocal(mejor.hasta) } : null,
  };
}

/** `n` fechas seguidas desde `fecha` (YYYY-MM-DD). */
export function fechasDesde(fecha: string, n: number): string[] {
  const base = new Date(`${fecha}T12:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10));
}

/**
 * Las noches del viaje en orden, y la mejor: la de más minutos oscuros; si empatan,
 * la de Luna más fina, y si no, la primera. null si ninguna noche llega a oscurecer.
 */
export function mejorNoche(lugar: Lugar, fechas: string[]): { noches: NocheDeCielo[]; mejor: NocheDeCielo | null } {
  const noches = fechas.map((f) => nocheDeCielo(lugar, f));
  let mejor: NocheDeCielo | null = null;
  for (const n of noches) {
    if (n.minutosOscuros === 0) continue;
    if (
      !mejor ||
      n.minutosOscuros > mejor.minutosOscuros ||
      (n.minutosOscuros === mejor.minutosOscuros && n.lunaIluminada < mejor.lunaIluminada)
    ) {
      mejor = n;
    }
  }
  return { noches, mejor };
}
