// Pasos de Starlink por lugar y noche, cacheados en el Runtime Cache de Vercel. Solo servidor.
// CelesTrak devuelve 403 si se baja el mismo set dos veces en menos de 2 horas desde la misma IP:
// el TLE se guarda en caché remota (compartida entre instancias) por 3 horas y se baja una sola vez.
import { cacheLife } from "next/cache";
import { getPlace } from "@/data/places";
import { buildDatetimeISO } from "@/features/cielo/cielo";
import { calcularPasos, leerTle, type PasosDeLaNoche } from "./pasos";

const CELESTRAK = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";

/** El set completo, sin espacios de relleno (~1,7 MB; el Runtime Cache acepta hasta 2 MB por ítem). */
async function tleStarlink(): Promise<string> {
  "use cache: remote";
  cacheLife({ stale: 3600, revalidate: 3 * 3600, expire: 24 * 3600 });

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

export async function pasosStarlink(placeId: string, fecha: string): Promise<PasosDeLaNoche | null> {
  "use cache: remote";
  cacheLife("hours");

  const place = getPlace(placeId);
  if (!place) return null;
  const tles = leerTle(await tleStarlink());
  if (tles.length === 0) throw new Error("CelesTrak sin TLE");
  return calcularPasos(tles, place, buildDatetimeISO(fecha, "12:00"));
}
