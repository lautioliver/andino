// Lógica pura de la pantalla Cielo (sin React ni efemérides): fechas, proyección y rumbos.
// Propiedad: jehp23.

// Jujuy usa UTC−3 todo el año (sin horario de verano desde 2009).
export const ZONA_ARGENTINA = "-03:00";
export const HORA_EJEMPLO = "22:00";

/** "2026-11-22" + "22:00" → "2026-11-22T22:00:00-03:00". */
export function buildDatetimeISO(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00${ZONA_ARGENTINA}`;
}

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

const RUMBOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"] as const;

/** Acimut en grados → rumbo de 8 puntos ("noreste"). */
export function rumbo(acimutDeg: number): (typeof RUMBOS)[number] {
  const normalizado = ((acimutDeg % 360) + 360) % 360;
  return RUMBOS[Math.round(normalizado / 45) % 8];
}

/** Descripción de la altura para no especialistas. */
export function describirAltura(altitudDeg: number): string {
  if (altitudDeg <= 0) return "bajo el horizonte";
  if (altitudDeg < 15) return "muy bajo, cerca del horizonte";
  if (altitudDeg < 45) return "a media altura";
  if (altitudDeg < 75) return "alto en el cielo";
  return "casi sobre tu cabeza";
}

export type Luz = "noche" | "crepusculo" | "dia";

/** Según la altura del Sol: día (> 0°), crepúsculo (hasta −12°, náutico) o noche. */
export function luzDelCielo(altitudSolDeg: number): Luz {
  if (altitudSolDeg > 0) return "dia";
  if (altitudSolDeg > -12) return "crepusculo";
  return "noche";
}
