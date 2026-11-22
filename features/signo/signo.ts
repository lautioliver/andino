// «Tu signo en el cielo»: dónde está de verdad la constelación de tu signo, y en qué constelación
// estaba el Sol el día de tu cumpleaños. Astronomía, sin predicciones (docs/plan.md §4.3).
//
// Lógica pura, sin DOM ni imports relativos de valor: los tests corren este .ts directo con node.
// La interfaz está en TuSigno.tsx, dentro de «De noche» en la ficha.
import { Body, Constellation, EquatorFromVector, GeoVector, HorizonFromVector, MakeTime, Observer, Rotation_EQJ_HOR, RotateVector, Spherical, VectorFromSphere } from "astronomy-engine";

export type SignoId =
  | "aries"
  | "tauro"
  | "geminis"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "escorpio"
  | "sagitario"
  | "capricornio"
  | "acuario"
  | "piscis";

export interface Signo {
  id: SignoId;
  nombre: string;
  /** Abreviatura IAU de la constelación homónima. */
  constelacion: string;
  /** Fechas habituales del horóscopo (MM-DD, inclusive). Varían un día según la fuente. */
  desde: string;
  hasta: string;
  /** Punto de referencia de la constelación (AR, Dec J2000 en grados): la etiqueta de d3-celestial, de data/cielo/catalogo.json. */
  centro: readonly [number, number];
}

export const SIGNOS: readonly Signo[] = [
  { id: "aries", nombre: "Aries", constelacion: "Ari", desde: "03-21", hasta: "04-19", centro: [39.54, 20.79] },
  { id: "tauro", nombre: "Tauro", constelacion: "Tau", desde: "04-20", hasta: "05-20", centro: [70, 15] },
  { id: "geminis", nombre: "Géminis", constelacion: "Gem", desde: "05-21", hasta: "06-20", centro: [106.06, 22.6] },
  { id: "cancer", nombre: "Cáncer", constelacion: "Cnc", desde: "06-21", hasta: "07-22", centro: [129.74, 19.81] },
  { id: "leo", nombre: "Leo", constelacion: "Leo", desde: "07-23", hasta: "08-22", centro: [160, 13] },
  { id: "virgo", nombre: "Virgo", constelacion: "Vir", desde: "08-23", hasta: "09-22", centro: [202, -4] },
  { id: "libra", nombre: "Libra", constelacion: "Lib", desde: "09-23", hasta: "10-22", centro: [227.99, -15.23] },
  { id: "escorpio", nombre: "Escorpio", constelacion: "Sco", desde: "10-23", hasta: "11-21", centro: [254, -32] },
  { id: "sagitario", nombre: "Sagitario", constelacion: "Sgr", desde: "11-22", hasta: "12-21", centro: [286.48, -28.48] },
  { id: "capricornio", nombre: "Capricornio", constelacion: "Cap", desde: "12-22", hasta: "01-19", centro: [315.73, -18.02] },
  { id: "acuario", nombre: "Acuario", constelacion: "Aqr", desde: "01-20", hasta: "02-18", centro: [335, -11] },
  { id: "piscis", nombre: "Piscis", constelacion: "Psc", desde: "02-19", hasta: "03-20", centro: [7, 14] },
];

/** Nombres en castellano de las 13 constelaciones que cruza el Sol (las 12 del zodíaco y Ofiuco). */
const CONSTELACIONES_DEL_SOL: Record<string, string> = {
  ...Object.fromEntries(SIGNOS.map((s) => [s.constelacion, s.nombre])),
  Oph: "Ofiuco",
};

/** Nombres en inglés por constelación IAU (signos y Ofiuco). */
export const NOMBRES_EN: Record<string, string> = {
  Ari: "Aries", Tau: "Taurus", Gem: "Gemini", Cnc: "Cancer", Leo: "Leo", Vir: "Virgo",
  Lib: "Libra", Sco: "Scorpius", Sgr: "Sagittarius", Cap: "Capricornus", Aqr: "Aquarius", Psc: "Pisces", Oph: "Ophiuchus",
};

export function getSigno(id: string | null | undefined): Signo | undefined {
  return SIGNOS.find((s) => s.id === id);
}

/** El signo del horóscopo para un día del año (mes 1–12). */
export function signoPorFecha(mes: number, dia: number): Signo {
  const md = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const signo = SIGNOS.find((s) => (s.desde <= s.hasta ? md >= s.desde && md <= s.hasta : md >= s.desde || md <= s.hasta));
  if (!signo) throw new Error(`Fecha inválida: ${md}`);
  return signo;
}

/** Constelación (IAU) en la que estaba el Sol ese día, al mediodía de Argentina. `fecha`: YYYY-MM-DD. */
export function constelacionDelSol(fecha: string): { id: string; nombre: string } {
  const time = MakeTime(new Date(`${fecha}T12:00:00-03:00`));
  const eq = EquatorFromVector(GeoVector(Body.Sun, time, true)); // J2000, como pide Constellation()
  const { symbol, name } = Constellation(eq.ra, eq.dec);
  return { id: symbol, nombre: CONSTELACIONES_DEL_SOL[symbol] ?? name };
}

/** Lo que muestra la tarjeta: tu signo según el horóscopo y dónde estaba el Sol de verdad. */
export function tuCumpleEnElCielo(fecha: string): { horoscopo: Signo; sol: { id: string; nombre: string }; coinciden: boolean } {
  const [, mes, dia] = fecha.split("-").map(Number);
  const horoscopo = signoPorFecha(mes, dia);
  const sol = constelacionDelSol(fecha);
  return { horoscopo, sol, coinciden: sol.id === horoscopo.constelacion };
}

export interface Lugar {
  latitude: number;
  longitude: number;
}

export interface Posicion {
  /** Altitud geométrica en grados (sin refracción: es el centro de una figura, no una estrella). */
  alt: number;
  /** Acimut desde el norte, en sentido horario. */
  az: number;
  sobreHorizonte: boolean;
}

/** Dónde está el centro de la constelación del signo, para un lugar y un instante (ISO con zona). */
export function posicionDelSigno(id: SignoId, lugar: Lugar, datetimeISO: string): Posicion {
  const signo = getSigno(id);
  if (!signo) throw new Error(`Signo desconocido: ${id}`);
  const time = MakeTime(new Date(datetimeISO));
  const rot = Rotation_EQJ_HOR(time, new Observer(lugar.latitude, lugar.longitude, 0));
  const [ar, dec] = signo.centro;
  const eqj = VectorFromSphere(new Spherical(dec, ar, 1), time);
  const hor = HorizonFromVector(RotateVector(rot, eqj), "");
  return { alt: hor.lat, az: hor.lon, sobreHorizonte: hor.lat > 0 };
}

/**
 * La mejor hora de la noche para buscar tu signo: el momento más alto mientras el Sol está
 * más de 12° bajo el horizonte (cielo ya oscuro). `fecha` es la tarde en que empieza la noche.
 * null si esa noche no sube a más de `alturaMinima` grados.
 */
export function mejorMomento(id: SignoId, lugar: Lugar, fecha: string, alturaMinima = 15): { datetimeISO: string; posicion: Posicion } | null {
  const inicio = new Date(`${fecha}T18:00:00-03:00`).getTime();
  const observer = new Observer(lugar.latitude, lugar.longitude, 0);
  let mejor: { datetimeISO: string; posicion: Posicion } | null = null;
  for (let min = 0; min <= 12 * 60; min += 10) {
    const instante = new Date(inicio + min * 60_000);
    const time = MakeTime(instante);
    const sol = HorizonFromVector(RotateVector(Rotation_EQJ_HOR(time, observer), GeoVector(Body.Sun, time, true)), "");
    if (sol.lat > -12) continue;
    const datetimeISO = instante.toISOString();
    const posicion = posicionDelSigno(id, lugar, datetimeISO);
    if (posicion.alt >= alturaMinima && (!mejor || posicion.alt > mejor.posicion.alt)) mejor = { datetimeISO, posicion };
  }
  return mejor;
}
