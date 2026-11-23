// Lógica pura de la pantalla Cielo (sin React ni efemérides): fechas, proyección y rumbos.
// Escrito por jehp23.

// Jujuy usa UTC−3 todo el año (sin horario de verano desde 2009).
export const ZONA_ARGENTINA = "-03:00";
export const HORA_EJEMPLO = "22:00";

/** "2026-11-22" + "22:00" → "2026-11-22T22:00:00-03:00". */
export function buildDatetimeISO(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00${ZONA_ARGENTINA}`;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lee ?fecha=YYYY-MM-DD&hora=HH:MM de la URL; si falta o no es válido, devuelve null. */
export function momentoDesdeURL(fecha: string | null, hora: string | null): { fecha: string; hora: string } | null {
  if (!fecha || !hora || !FECHA.test(fecha) || !HORA.test(hora)) return null;
  if (Number.isNaN(new Date(buildDatetimeISO(fecha, hora)).getTime())) return null;
  return { fecha, hora };
}

/** Query de /cielo: el lugar siempre; fecha y hora solo si no son el ejemplo. */
export function queryCielo(placeId: string, momento: { fecha: string; hora: string } | null): string {
  const q = new URLSearchParams({ placeId });
  if (momento) {
    q.set("fecha", momento.fecha);
    q.set("hora", momento.hora);
  }
  return `?${q}`;
}

/**
 * Escenario de la demo, verificado contra JPL Horizons (Luna, Júpiter, Saturno) y un cálculo
 * independiente (Sirio, Acrux): desde Purmamarca, los cinco objetos quedan a más de 10° sobre
 * el horizonte, con el Sol a −38° (noche cerrada). Ver docs/demo-cielo.md.
 */
export const DEMO_CIELO = { placeId: "purmamarca", fecha: "2026-11-23", hora: "03:00" } as const;

/** Fecha de hoy en Argentina, "YYYY-MM-DD", para el valor inicial de ejemplo. */
export function fechaArgentina(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Jujuy" }).format(ahora);
}

/**
 * Proyección del domo celeste a un círculo de radio `radio` (azimutal equidistante):
 * centro = cenit, borde = horizonte, norte arriba y este a la izquierda, como un mapa
 * del cielo que se sostiene sobre la cabeza. Devuelve coordenadas relativas al centro.
 */
export function proyectarEnDomo(altitudDeg: number, acimutDeg: number, radio: number): { x: number; y: number } {
  const r = ((90 - altitudDeg) / 90) * radio;
  const az = (acimutDeg * Math.PI) / 180;
  return { x: -r * Math.sin(az), y: -r * Math.cos(az) };
}

const RUMBOS = {
  es: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
  en: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"],
} as const;

/** Acimut en grados → rumbo de 8 puntos ("noreste" / "northeast"). */
export function rumbo(acimutDeg: number, lang: "es" | "en" = "es"): string {
  const normalizado = ((acimutDeg % 360) + 360) % 360;
  return RUMBOS[lang][Math.round(normalizado / 45) % 8];
}

/**
 * Hacia dónde apunta el teléfono, en corto: «Norte · 35°». La altura va en grados enteros sobre el
 * horizonte; debajo de él, con signo menos.
 */
export function rumboYAltura(acimutDeg: number, altitudDeg: number, lang: "es" | "en" = "es"): string {
  const nombre = rumbo(acimutDeg, lang);
  const grados = Math.round(Math.max(-90, Math.min(90, altitudDeg)));
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} · ${grados < 0 ? "−" : ""}${Math.abs(grados)}°`;
}

const ALTURAS = {
  es: ["bajo el horizonte", "muy bajo, cerca del horizonte", "a media altura", "alto en el cielo", "casi sobre tu cabeza"],
  en: ["below the horizon", "very low, near the horizon", "halfway up", "high in the sky", "almost overhead"],
} as const;

/** Descripción de la altura para no especialistas. */
export function describirAltura(altitudDeg: number, lang: "es" | "en" = "es"): string {
  const a = ALTURAS[lang];
  if (altitudDeg <= 0) return a[0];
  if (altitudDeg < 15) return a[1];
  if (altitudDeg < 45) return a[2];
  if (altitudDeg < 75) return a[3];
  return a[4];
}

export type Luz = "noche" | "crepusculo" | "dia";

/** Según la altura del Sol: día (> 0°), crepúsculo (hasta −12°, náutico) o noche. */
export function luzDelCielo(altitudSolDeg: number): Luz {
  if (altitudSolDeg > 0) return "dia";
  if (altitudSolDeg > -12) return "crepusculo";
  return "noche";
}
