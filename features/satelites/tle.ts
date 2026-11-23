// TLE de CelesTrak con copia en Vercel Blob: la parte con red de respaldo.ts. Solo servidor.
// La copia sobrevive a los deploys: si tiene menos de 2 horas se usa sin llamar a CelesTrak, y si
// CelesTrak falla se usa aunque sea más vieja (hasta 3 días). Cada set tiene su propia clave en Blob.
import { get, put } from "@vercel/blob";
import { limpiarTle, tleConRespaldo, type Respaldo } from "./respaldo";

export interface FuenteDeTle {
  /** URL de CelesTrak, formato TLE. */
  url: string;
  /** Clave de la copia en Blob; una por set, nunca compartida. */
  respaldo: string;
  valido(texto: string): boolean;
}

const avisar = (mensaje: string, causa?: unknown) => console.warn(`[satelites] ${mensaje}`, causa);

async function leerRespaldo(clave: string): Promise<Respaldo | null> {
  try {
    const r = await get(clave, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(10_000) });
    if (!r || r.statusCode !== 200) return null;
    return { texto: limpiarTle(await new Response(r.stream).text()), edadMs: Date.now() - r.blob.uploadedAt.getTime() };
  } catch (e) {
    avisar(`no se pudo leer el respaldo de órbitas (${clave})`, e);
    return null;
  }
}

async function guardarRespaldo(clave: string, texto: string) {
  await put(clave, texto, {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "text/plain; charset=utf-8",
  });
}

async function bajar(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "andino-app" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`CelesTrak ${res.status}`);
  return res.text();
}

/** El set, sin caché propia: quien lo llama lo guarda con `"use cache: remote"` y VIDA_TLE. */
export async function tleDeCelestrak(fuente: FuenteDeTle): Promise<string> {
  try {
    return await tleConRespaldo({
      leerRespaldo: () => leerRespaldo(fuente.respaldo),
      bajar: () => bajar(fuente.url),
      guardarRespaldo: (texto) => guardarRespaldo(fuente.respaldo, texto),
      valido: fuente.valido,
      avisar,
    });
  } catch (e) {
    // Se anota acá: en producción, un error que sale de una función con caché llega a la ruta sin su mensaje.
    console.error(`[satelites] sin órbitas: CelesTrak falló y no hay respaldo utilizable (${fuente.respaldo})`, e);
    throw e;
  }
}
