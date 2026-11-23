// Cuándo bajar un TLE de CelesTrak y cuándo usar la copia de respaldo. La misma regla para todos los
// sets (Starlink, la Estación Espacial): CelesTrak devuelve 403 si se baja el mismo set dos veces en
// menos de 2 horas desde la misma IP.
//
// Lógica pura, sin red ni imports de valor: quién lee, baja y guarda llega por parámetro (tle.ts), y
// los tests corren este .ts directo con node.

const HORA_MS = 3_600_000;
/** Un respaldo más nuevo que esto se usa sin llamar a CelesTrak. */
export const RESPALDO_FRESCO_MS = 2 * HORA_MS;
/** Pasado eso, las órbitas de satélites tan bajos ya no dan horarios confiables. */
export const RESPALDO_MAXIMO_MS = 72 * HORA_MS;
/** Vida del TLE en la caché remota, en segundos: se vuelve a pedir, como mucho, cada 3 horas. */
export const VIDA_TLE = { stale: 3600, revalidate: 3 * 3600, expire: 24 * 3600 };

export interface Respaldo {
  texto: string;
  edadMs: number;
}

export interface OrigenDeTle {
  /** La copia guardada, o null si no hay o no se pudo leer. */
  leerRespaldo(): Promise<Respaldo | null>;
  /** El set recién bajado de CelesTrak; rechaza si no responde bien. */
  bajar(): Promise<string>;
  guardarRespaldo(texto: string): Promise<void>;
  /** ¿El texto es el set esperado? Una página de error no se guarda ni se usa. */
  valido(texto: string): boolean;
  avisar?(mensaje: string, causa?: unknown): void;
}

/** Sin espacios de relleno ni líneas vacías: tres líneas por satélite. */
export function limpiarTle(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * El TLE a usar: el respaldo si es fresco; si no, se baja y se guarda; y si la bajada falla, el
 * respaldo aunque sea más viejo, hasta RESPALDO_MAXIMO_MS. Sin ninguno de los dos, rechaza.
 */
export async function tleConRespaldo(origen: OrigenDeTle): Promise<string> {
  const leido = await origen.leerRespaldo();
  const respaldo = leido && origen.valido(leido.texto) ? leido : null;
  if (respaldo && respaldo.edadMs < RESPALDO_FRESCO_MS) return respaldo.texto;

  let texto: string;
  try {
    texto = limpiarTle(await origen.bajar());
    if (!origen.valido(texto)) throw new Error("CelesTrak: respuesta inesperada");
  } catch (e) {
    if (respaldo && respaldo.edadMs < RESPALDO_MAXIMO_MS) {
      origen.avisar?.(`CelesTrak falló; uso el respaldo de hace ${Math.round(respaldo.edadMs / HORA_MS)} h`, e);
      return respaldo.texto;
    }
    throw e;
  }
  // Que no se pueda guardar la copia no es motivo para tirar lo que ya se bajó.
  await origen.guardarRespaldo(texto).catch((e) => origen.avisar?.("no se pudo guardar el respaldo de órbitas", e));
  return texto;
}
