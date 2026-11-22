import type { AndinoPlace, PlaceId } from "@/shared/types";

// Fuente única de lugares para Pacha y Cielo.
// PROVISORIO: coordenadas aproximadas y fuentes pendientes de curar (plan.md §14).
export const places: AndinoPlace[] = [
  { id: "purmamarca", name: "Purmamarca", latitude: -23.744, longitude: -65.499, sourceUrls: [] },
  { id: "tilcara", name: "Tilcara", latitude: -23.577, longitude: -65.396, sourceUrls: [] },
  { id: "humahuaca", name: "Humahuaca", latitude: -23.205, longitude: -65.349, sourceUrls: [] },
];

export function getPlace(id: string | null | undefined): AndinoPlace | undefined {
  return places.find((p) => p.id === (id as PlaceId));
}
