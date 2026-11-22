// La noche de un lugar contada hora por hora: puesta del sol, cielo oscuro, Luna y alba.
// Módulo puro (solo astronomy-engine), con tests en linea.test.mjs. Nada se inventa:
// si un evento no ocurre esa noche, no aparece.
import { Body, Equator, Horizon, MakeTime, Observer, SearchAltitude, SearchRiseSet } from "astronomy-engine";

export interface Lugar {
  latitude: number;
  longitude: number;
}

export type TipoEvento = "puesta" | "oscuro" | "salida-luna" | "puesta-luna" | "alba";

export interface Evento {
  tipo: TipoEvento;
  iso: string; // instante del evento (UTC)
  titulo: string;
}

export interface LineaDeLaNoche {
  eventos: Evento[]; // en orden cronológico, de la puesta del sol al alba
  /** Tramo más largo con cielo oscuro y la Luna bajo el horizonte; null si la Luna está toda la noche. */
  sinLuna: { desde: string; hasta: string } | null;
}

const TITULOS: Record<TipoEvento, string> = {
  puesta: "Se pone el sol",
  oscuro: "Cielo oscuro",
  "salida-luna": "Sale la Luna",
  "puesta-luna": "Se pone la Luna",
  alba: "Empieza a clarear",
};

/** Títulos en inglés, por tipo de evento (la línea se calcula en español). */
export const TITULOS_EN: Record<TipoEvento, string> = {
  puesta: "Sunset",
  oscuro: "Dark sky",
  "salida-luna": "Moonrise",
  "puesta-luna": "Moonset",
  alba: "Dawn breaks",
};

const PASO_MIN = 5;

function alturaLuna(observer: Observer, fecha: Date): number {
  const t = MakeTime(fecha);
  const eq = Equator(Body.Moon, t, observer, true, true);
  return Horizon(t, observer, eq.ra, eq.dec, "normal").altitude;
}

/** `fecha` es YYYY-MM-DD de la tarde en que empieza la noche, hora de Argentina (UTC−3). */
export function lineaDeLaNoche(lugar: Lugar, fecha: string): LineaDeLaNoche | null {
  const observer = new Observer(lugar.latitude, lugar.longitude, 0);
  const mediodia = MakeTime(new Date(`${fecha}T12:00:00-03:00`));

  const puesta = SearchRiseSet(Body.Sun, observer, -1, mediodia, 1);
  if (!puesta) return null;
  // Crepúsculo astronómico: el Sol 18° bajo el horizonte.
  const oscuro = SearchAltitude(Body.Sun, observer, -1, puesta, 1, -18);
  const alba = oscuro && SearchAltitude(Body.Sun, observer, +1, oscuro, 1, -18);
  if (!oscuro || !alba) return null;

  const eventos: Evento[] = [
    { tipo: "puesta", iso: puesta.date.toISOString(), titulo: TITULOS.puesta },
    { tipo: "oscuro", iso: oscuro.date.toISOString(), titulo: TITULOS.oscuro },
    { tipo: "alba", iso: alba.date.toISOString(), titulo: TITULOS.alba },
  ];

  // La Luna cuenta solo si sale o se pone entre la puesta del sol y el alba.
  const fin = alba.date.getTime();
  for (const [tipo, dir] of [["salida-luna", +1], ["puesta-luna", -1]] as const) {
    const e = SearchRiseSet(Body.Moon, observer, dir, puesta, 1);
    if (e && e.date.getTime() < fin) eventos.push({ tipo, iso: e.date.toISOString(), titulo: TITULOS[tipo] });
  }
  eventos.sort((a, b) => a.iso.localeCompare(b.iso));

  // Tramo oscuro y sin Luna más largo, muestreado cada 5 minutos.
  let mejor: { desde: number; hasta: number } | null = null;
  let inicio: number | null = null;
  const desde = oscuro.date.getTime();
  for (let t = desde; t <= fin; t += PASO_MIN * 60_000) {
    const sinLuna = alturaLuna(observer, new Date(t)) < 0;
    if (sinLuna && inicio === null) inicio = t;
    const cierra = inicio !== null && (!sinLuna || t + PASO_MIN * 60_000 > fin);
    if (cierra) {
      const hasta = sinLuna ? t : t - PASO_MIN * 60_000;
      if (hasta > inicio! && (!mejor || hasta - inicio! > mejor.hasta - mejor.desde)) mejor = { desde: inicio!, hasta };
      inicio = null;
    }
  }

  return {
    eventos,
    sinLuna: mejor && mejor.hasta - mejor.desde >= 30 * 60_000
      ? { desde: new Date(mejor.desde).toISOString(), hasta: new Date(mejor.hasta).toISOString() }
      : null,
  };
}
