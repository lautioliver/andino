// Pasos de Starlink por lugar y noche, cacheados en el Runtime Cache de Vercel. Solo servidor.
// CelesTrak devuelve 403 si se baja el mismo set dos veces en menos de 2 horas desde la misma IP:
// el TLE se guarda en caché remota (compartida entre instancias) por 3 horas y se baja una sola vez.
// Además queda una copia en Vercel Blob, que sobrevive a los deploys: si tiene menos de 2 horas se usa
// sin llamar a CelesTrak, y si CelesTrak falla se usa aunque sea más vieja (hasta 3 días).
import { get, put } from "@vercel/blob";
import { cacheLife } from "next/cache";
import { getPlace } from "@/data/places";
import { buildDatetimeISO } from "@/features/cielo/cielo";
import { calcularPasos, leerTle, type PasosDeLaNoche } from "./pasos";

const CELESTRAK = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";

const RESPALDO = "satelites/starlink.tle";
const HORA_MS = 3_600_000;
const RESPALDO_FRESCO_MS = 2 * HORA_MS;
// Pasado eso, las órbitas de satélites tan bajos ya no dan horarios confiables.
const RESPALDO_MAXIMO_MS = 72 * HORA_MS;

type Respaldo = { texto: string; edadMs: number };

async function leerRespaldo(): Promise<Respaldo | null> {
  try {
    const r = await get(RESPALDO, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(10_000) });
    if (!r || r.statusCode !== 200) return null;
    return { texto: await new Response(r.stream).text(), edadMs: Date.now() - r.blob.uploadedAt.getTime() };
  } catch (e) {
    console.warn("[satelites] no se pudo leer el respaldo de órbitas", e);
    return null;
  }
}

async function guardarRespaldo(texto: string) {
  try {
    await put(RESPALDO, texto, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "text/plain; charset=utf-8",
    });
  } catch (e) {
    console.warn("[satelites] no se pudo guardar el respaldo de órbitas", e);
  }
}

async function bajarDeCelestrak(): Promise<string> {
  const res = await fetch(CELESTRAK, { headers: { "user-agent": "andino-app" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`CelesTrak ${res.status}`);
  const texto = (await res.text())
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  if (!texto.startsWith("STARLINK")) throw new Error("CelesTrak: respuesta inesperada");
  return texto;
}

/** El set completo, sin espacios de relleno (~1,7 MB; el Runtime Cache acepta hasta 2 MB por ítem). */
async function tleStarlink(): Promise<string> {
  "use cache: remote";
  cacheLife({ stale: 3600, revalidate: 3 * 3600, expire: 24 * 3600 });

  const respaldo = await leerRespaldo();
  if (respaldo && respaldo.edadMs < RESPALDO_FRESCO_MS) return respaldo.texto;

  try {
    const texto = await bajarDeCelestrak();
    await guardarRespaldo(texto);
    return texto;
  } catch (e) {
    if (respaldo && respaldo.edadMs < RESPALDO_MAXIMO_MS) {
      console.warn(`[satelites] CelesTrak falló; uso el respaldo de hace ${Math.round(respaldo.edadMs / HORA_MS)} h`, e);
      return respaldo.texto;
    }
    throw e;
  }
}

export async function pasosStarlink(placeId: string, fecha: string): Promise<PasosDeLaNoche | null> {
  "use cache: remote";
  cacheLife("hours");

  const place = getPlace(placeId);
  if (!place) return null;
  const tles = leerTle(await tleStarlink());
  if (tles.length === 0) throw new Error("CelesTrak sin TLE");
  return calcularPasos(tles, place, buildDatetimeISO(fecha, "12:00"));
}
