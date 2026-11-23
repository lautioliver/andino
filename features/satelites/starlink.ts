// Pasos de Starlink por lugar y noche, cacheados en el Runtime Cache de Vercel. Solo servidor.
// CelesTrak devuelve 403 si se baja el mismo set dos veces en menos de 2 horas desde la misma IP:
// el TLE se guarda en caché remota (compartida entre instancias) por 3 horas y se baja una sola vez.
// Además queda una copia en Vercel Blob, que sobrevive a los deploys: si tiene menos de 2 horas se usa
// sin llamar a CelesTrak, y si CelesTrak falla se usa aunque sea más vieja (hasta 3 días). Esa regla
// está en respaldo.ts y la comparte la Estación Espacial (estacion.ts).
import { cacheLife } from "next/cache";
import { getPlace } from "@/data/places";
import { buildDatetimeISO } from "@/features/cielo/cielo";
import { calcularPasos, leerTle, type PasosDeLaNoche } from "./pasos";
import { VIDA_TLE } from "./respaldo";
import { tleDeCelestrak, type FuenteDeTle } from "./tle";

const STARLINK: FuenteDeTle = {
  url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
  respaldo: "satelites/starlink.tle",
  valido: (texto) => texto.startsWith("STARLINK"),
};

/** El set completo, sin espacios de relleno (~1,7 MB; el Runtime Cache acepta hasta 2 MB por ítem). */
async function tleStarlink(): Promise<string> {
  "use cache: remote";
  cacheLife(VIDA_TLE);
  return tleDeCelestrak(STARLINK);
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
