// «Ver con la cámara»: qué hay en el centro de la pantalla, donde está la mira.
// Lógica pura (sin DOM ni imports de valor): los tests corren este .ts directo con node.

const RAD = Math.PI / 180;

export interface Direccion {
  /** Altura sobre el horizonte, grados. */
  alt: number;
  /** Acimut desde el norte, grados. */
  az: number;
}

/** Separación angular entre dos direcciones del cielo, en grados (0 a 180). */
export function separacion(a: Direccion, b: Direccion): number {
  const coseno =
    Math.sin(a.alt * RAD) * Math.sin(b.alt * RAD) + Math.cos(a.alt * RAD) * Math.cos(b.alt * RAD) * Math.cos((a.az - b.az) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, coseno))) / RAD;
}

export interface Candidato extends Direccion {
  id: string;
  /** «objeto»: un punto con ficha (Luna, planetas, estrellas destacadas). «figura»: una constelación o la Yacana, por su rótulo. */
  tipo: "objeto" | "figura";
}

/** Hasta qué distancia de la mira cuenta cada tipo, en grados: un objeto es un punto; una figura ocupa un buen pedazo de cielo. */
export const RADIO_MIRA = { objeto: 10, figura: 30 } as const;

/** Lo que ya está en la mira se queda hasta que otro le gane por esta ventaja (grados): sin ella, entre dos vecinos el nombre parpadea. */
export const VENTAJA_MIRA = 2;

/**
 * Lo más cercano al centro de la pantalla. Un objeto dentro de su radio le gana a cualquier figura: es lo
 * que se puede abrir. Lo que está bajo el horizonte no cuenta (no se dibuja). `null` si no hay nada cerca.
 */
export function enLaMira(mirada: Direccion, candidatos: readonly Candidato[], actualId: string | null = null): Candidato | null {
  const mejor: Record<Candidato["tipo"], { candidato: Candidato; distancia: number } | null> = { objeto: null, figura: null };
  for (const candidato of candidatos) {
    if (!(candidato.alt > 0)) continue;
    const distancia = separacion(mirada, candidato) - (candidato.id === actualId ? VENTAJA_MIRA : 0);
    if (distancia > RADIO_MIRA[candidato.tipo]) continue;
    const anterior = mejor[candidato.tipo];
    if (!anterior || distancia < anterior.distancia) mejor[candidato.tipo] = { candidato, distancia };
  }
  return (mejor.objeto ?? mejor.figura)?.candidato ?? null;
}
