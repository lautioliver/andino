// Pasos visibles de la Estación Espacial Internacional por lugar y noche. Solo servidor.
// Mismo esquema que Starlink (starlink.ts): el TLE va a la caché remota con la misma vida, así que no se
// baja más seguido, y tiene su propia copia en Vercel Blob para cuando CelesTrak no responde. Si falla,
// eso también se guarda, 10 minutos: mientras tanto nadie vuelve a llamarlo.
import { cacheLife } from "next/cache";
import { getPlace } from "@/data/places";
import { buildDatetimeISO } from "@/features/cielo/cielo";
import { ALTURA_MIN_DEG, calcularPasos, leerTle, type PasosDeLaNoche } from "./pasos";
import { tleDeCelestrak, type FuenteDeTle } from "./tle";

/** Número de catálogo NORAD de la Estación (ISS, módulo Zarya). */
const NORAD_ESTACION = 25544;

/** Del texto, solo el TLE de la Estación: una página de error o de otro objeto da una lista vacía. */
const tlesDeLaEstacion = (texto: string) => leerTle(texto).filter((t) => Number(t.rec.satnum) === NORAD_ESTACION);

const ESTACION: FuenteDeTle = {
  url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${NORAD_ESTACION}&FORMAT=tle`,
  // Clave propia: la de Starlink (satelites/starlink.tle) no se toca.
  respaldo: "satelites/estacion.tle",
  valido: (texto) => tlesDeLaEstacion(texto).length > 0,
};

/** El TLE de la Estación, o null si CelesTrak falló y no hay respaldo utilizable. */
async function tleEstacion(): Promise<string | null> {
  "use cache: remote";
  const { texto, vida } = await tleDeCelestrak(ESTACION);
  // Lo que salió bien dura 3 horas (VIDA_TLE). Si CelesTrak falló, lo que haya (el respaldo, o null)
  // dura 10 minutos (VIDA_TRAS_FALLO) y después se reintenta.
  cacheLife(vida);
  return texto;
}

/** Es un solo objeto y brillante: se listan todos sus pasos sobre 10°, no solo los altos. */
export async function pasosEstacion(placeId: string, fecha: string): Promise<PasosDeLaNoche | null> {
  "use cache: remote";
  cacheLife("hours");

  const place = getPlace(placeId);
  if (!place) return null;
  const texto = await tleEstacion();
  // Tirar el error acá, y no en tleEstacion, deja el fallo guardado: este error no se guarda, pero el
  // pedido siguiente encuentra el null en la caché y no vuelve a llamar a CelesTrak.
  if (texto === null) throw new Error("Sin órbitas de la Estación: CelesTrak falló y no hay respaldo");
  const tles = tlesDeLaEstacion(texto);
  if (tles.length === 0) throw new Error("CelesTrak sin TLE de la Estación");
  return calcularPasos(tles, place, buildDatetimeISO(fecha, "12:00"), 6, ALTURA_MIN_DEG);
}
