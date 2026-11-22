// Cielo desde la ubicación del teléfono: el cálculo usa las coordenadas reales y la ficha sigue siendo
// la de la parada del Tren Solar más cercana. Las coordenadas no salen del teléfono ni van a la URL.

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

const RADIO_TIERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia sobre la superficie de la Tierra (haversine), en km. */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** La parada más cercana a una posición, con su distancia. `null` si no hay paradas. */
export function paradaMasCercana<P extends Coordenadas>(pos: Coordenadas, paradas: readonly P[]): { parada: P; km: number } | null {
  let mejor: { parada: P; km: number } | null = null;
  for (const parada of paradas) {
    const km = distanciaKm(pos, parada);
    if (!mejor || km < mejor.km) mejor = { parada, km };
  }
  return mejor;
}

/** A partir de esta distancia decimos que el teléfono está lejos del recorrido del tren. */
export const LEJOS_KM = 25;

/** Una posición sirve si son números finitos dentro del rango de latitud y longitud. */
export function posicionValida(p: Partial<Coordenadas> | null | undefined): p is Coordenadas {
  return (
    !!p &&
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}

/** Distancia para mostrar: menos de 1 km en metros redondeados a 100, si no en km enteros. */
export function textoDistancia(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${Math.round(km)} km`;
}
