// Pasos de Starlink por lugar y noche, cacheados en el Runtime Cache de Vercel. Solo servidor.
// CelesTrak devuelve 403 si se baja el mismo set dos veces en menos de 2 horas desde la misma IP:
// el TLE se guarda en caché remota (compartida entre instancias) por 3 horas y se baja una sola vez.
// Además queda una copia en Vercel Blob, que sobrevive a los deploys: si tiene menos de 2 horas se usa
// sin llamar a CelesTrak, y si CelesTrak falla se usa aunque sea más vieja (hasta 3 días). Un fallo de
// CelesTrak también se guarda en la caché, 10 minutos: mientras tanto los pedidos reciben lo que quedó
// (el respaldo, o que no hay órbitas) sin volver a llamarlo. Esa regla está en respaldo.ts y la
// comparte la Estación Espacial (estacion.ts).
import { cacheLife } from "next/cache";
import { getPlace } from "@/data/places";
import { buildDatetimeISO } from "@/features/cielo/cielo";
import { calcularPasos, leerTle, type PasosDeLaNoche } from "./pasos";
import { tleDeCelestrak, type FuenteDeTle } from "./tle";

const STARLINK: FuenteDeTle = {
  url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
  respaldo: "satelites/starlink.tle",
  valido: (texto) => texto.startsWith("STARLINK"),
};

/**
 * El set completo, sin espacios de relleno (~1,7 MB; el Runtime Cache acepta hasta 2 MB por ítem), o
 * null si CelesTrak falló y no hay respaldo utilizable.
 */
async function tleStarlink(): Promise<string | null> {
  "use cache: remote";
  const { texto, vida } = await tleDeCelestrak(STARLINK);
  // Lo que salió bien dura 3 horas (VIDA_TLE). Si CelesTrak falló, lo que haya (el respaldo, o null)
  // dura 10 minutos (VIDA_TRAS_FALLO) y después se reintenta.
  cacheLife(vida);
  return texto;
}

export async function pasosStarlink(placeId: string, fecha: string): Promise<PasosDeLaNoche | null> {
  "use cache: remote";
  cacheLife("hours");

  const place = getPlace(placeId);
  if (!place) return null;
  const texto = await tleStarlink();
  // Tirar el error acá, y no en tleStarlink, deja el fallo guardado: este error no se guarda, pero el
  // pedido siguiente encuentra el null en la caché y no vuelve a llamar a CelesTrak.
  if (texto === null) throw new Error("Sin órbitas de Starlink: CelesTrak falló y no hay respaldo");
  const tles = leerTle(texto);
  if (tles.length === 0) throw new Error("CelesTrak sin TLE");
  return calcularPasos(tles, place, buildDatetimeISO(fecha, "12:00"));
}
