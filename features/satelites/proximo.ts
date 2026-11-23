// «Próximo paso visible»: de los pasos de la noche (Estación Espacial y Starlink), cuál viene ahora
// y cuánto falta.
//
// Lógica pura, sin DOM ni imports de valor: los tests corren este .ts directo con node.
import type { PasosDeLaNoche, PasoVisible } from "./pasos";

export type Fuente = "estacion" | "starlink";

export interface Candidato {
  fuente: Fuente;
  paso: PasoVisible;
}

export type Proximo =
  /** Falta para que aparezca. */
  | { estado: "por-venir"; fuente: Fuente; paso: PasoVisible; faltanMs: number }
  /** Se está viendo en este momento. */
  | { estado: "en-curso"; fuente: Fuente; paso: PasoVisible }
  /** Hubo pasos esta noche y ya terminaron. */
  | { estado: "pasaron" }
  /** No hay ningún paso en la lista. */
  | { estado: "ninguno" };

const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN);

const esFecha = (x: unknown): x is string => typeof x === "string" && Number.isFinite(Date.parse(x));
const esNumero = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function leerPaso(x: unknown): PasoVisible | null {
  if (typeof x !== "object" || x === null) return null;
  const p = x as Record<string, unknown>;
  const fechas = esFecha(p.inicio) && esFecha(p.maximo) && esFecha(p.fin) && (p.termina === undefined || esFecha(p.termina));
  const numeros = [p.satelites, p.intervaloSeg, p.alturaMaxDeg, p.desdeAzDeg, p.hastaAzDeg].every(esNumero);
  if (!fechas || !numeros || typeof p.nombre !== "string") return null;
  // Una respuesta guardada antes de que existiera «termina»: se da por terminado en el máximo del último.
  return { ...(p as unknown as PasoVisible), termina: (p.termina ?? p.fin) as string, recienLanzado: p.recienLanzado === true };
}

/**
 * La respuesta de /api/satelites/*, revisada antes de dibujarla: con una fecha rota la interfaz se
 * rompería entera. Si algo no tiene la forma esperada devuelve null y la sección muestra su aviso.
 */
export function leerPasos(x: unknown): PasosDeLaNoche | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (!esFecha(r.desde) || !esFecha(r.hasta) || !esFecha(r.tleActualizado) || !esNumero(r.totalPasos) || !Array.isArray(r.destacados)) return null;
  const destacados = r.destacados.map(leerPaso);
  if (destacados.some((p) => p === null)) return null;
  return { desde: r.desde, hasta: r.hasta, totalPasos: r.totalPasos, tleActualizado: r.tleActualizado, destacados: destacados as PasoVisible[] };
}

/** Hasta cuándo se ve: la última muestra visible, y nunca antes del punto más alto del último de la fila. */
function finDelPaso(p: PasoVisible): number {
  const fin = Math.max(...[ms(p.termina), ms(p.fin), ms(p.maximo)].filter(Number.isFinite));
  return Number.isFinite(fin) ? fin : ms(p.inicio);
}

/** Entre dos pasos a la vez gana la Estación, que es la que más brilla; después, el más alto. */
const preferido = (a: Candidato, b: Candidato) =>
  Number(b.fuente === "estacion") - Number(a.fuente === "estacion") || b.paso.alturaMaxDeg - a.paso.alturaMaxDeg;

/**
 * Una fila de Starlink con un satélite cada varios minutos puede durar más de una hora: mientras dura
 * no tapa la cuenta regresiva del paso que viene. Un paso corto (un satélite, un tren) sí se anuncia.
 */
export const PASO_CORTO_MS = 15 * 60_000;

export function proximoPaso(candidatos: Candidato[], ahoraMs: number): Proximo {
  const validos = candidatos.filter((c) => Number.isFinite(ms(c.paso.inicio)));
  if (validos.length === 0) return { estado: "ninguno" };

  const enCurso = validos.filter((c) => ms(c.paso.inicio) <= ahoraMs && ahoraMs <= finDelPaso(c.paso)).sort(preferido);
  const corto = enCurso.find((c) => finDelPaso(c.paso) - ms(c.paso.inicio) <= PASO_CORTO_MS);
  if (corto) return { estado: "en-curso", ...corto };

  const porVenir = validos
    .filter((c) => ms(c.paso.inicio) > ahoraMs)
    .sort((a, b) => ms(a.paso.inicio) - ms(b.paso.inicio) || preferido(a, b))[0];
  if (porVenir) return { estado: "por-venir", ...porVenir, faltanMs: ms(porVenir.paso.inicio) - ahoraMs };

  if (enCurso[0]) return { estado: "en-curso", ...enCurso[0] };
  return { estado: "pasaron" };
}

/** Lo que falta, como en un reloj: «1 h 02 min 05 s», «12 min 05 s», «45 s». Redondea hacia arriba. */
export function cuentaRegresiva(faltanMs: number): string {
  const total = Number.isFinite(faltanMs) ? Math.max(0, Math.ceil(faltanMs / 1000)) : 0;
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h} h ${dos(min)} min ${dos(s)} s`;
  if (min > 0) return `${min} min ${dos(s)} s`;
  return `${s} s`;
}

/** ISO → fecha y hora del calendario de Jujuy (UTC−3 todo el año), como las espera /cielo. */
export function momentoLocal(iso: string): { fecha: string; hora: string } | null {
  const t = ms(iso);
  if (!Number.isFinite(t)) return null;
  const local = new Date(t - 3 * 3600_000).toISOString();
  return { fecha: local.slice(0, 10), hora: local.slice(11, 16) };
}
