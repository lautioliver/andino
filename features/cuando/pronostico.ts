// Pronóstico de nubes por lugar, de Open-Meteo (https://open-meteo.com/, CC BY 4.0, sin clave). Solo servidor.
// Una consulta por lugar y por hora como mucho: la respuesta se guarda en la caché remota, compartida
// entre instancias, igual que los pasos de Starlink (features/satelites/starlink.ts).
import { cacheLife } from "next/cache";
import { getPlace } from "@/data/places";
import { leerOpenMeteo, type NubesHorarias } from "./cuando";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/**
 * Nubosidad horaria del lugar: desde ayer (para que la noche en curso entre completa aunque en UTC ya
 * sea otro día) hasta el alcance del pronóstico, 16 días. null si el lugar no es uno de data/places.ts:
 * nunca se consulta por coordenadas que vengan de afuera. Si Open-Meteo falla, tira el error y no se
 * guarda nada: el que llama decide qué mostrar.
 */
export async function nubesDe(placeId: string): Promise<NubesHorarias | null> {
  "use cache: remote";
  // Se renueva cada hora; pasadas 3 horas sin pedidos ya no se sirve la copia vieja.
  cacheLife({ stale: 300, revalidate: 3600, expire: 3 * 3600 });

  const place = getPlace(placeId);
  if (!place) return null;
  const q = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    hourly: "cloud_cover",
    timezone: "UTC",
    past_days: "1",
    forecast_days: "16",
  });
  try {
    const res = await fetch(`${OPEN_METEO}?${q}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const nubes = leerOpenMeteo(await res.json());
    if (!nubes) throw new Error("Open-Meteo: respuesta inesperada");
    return nubes;
  } catch (e) {
    // Se registra acá: en producción, el error que sale de una función con caché llega afuera sin su mensaje.
    console.error(`[nubes] Open-Meteo falló para ${place.id}`, e);
    throw e;
  }
}
