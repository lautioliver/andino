import type { AndinoPlace, PlaceId } from "@/shared/types";

// Fuente única de lugares para Pacha y Cielo.
// Coordenadas aproximadas tomadas de Wikipedia (centro de la localidad), suficientes para cálculo astronómico.
export const places: AndinoPlace[] = [
  {
    id: "purmamarca",
    name: "Purmamarca",
    latitude: -23.7333,
    longitude: -65.4833,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Purmamarca",
      "https://es.wikipedia.org/wiki/Cerro_de_los_Siete_Colores",
      "https://whc.unesco.org/en/list/1116/",
    ],
  },
  {
    id: "tilcara",
    name: "Tilcara",
    latitude: -23.5768,
    longitude: -65.3934,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Tilcara",
      "https://es.wikipedia.org/wiki/Pucar%C3%A1_de_Tilcara",
      "https://whc.unesco.org/en/list/1116/",
    ],
  },
  {
    id: "humahuaca",
    name: "Humahuaca",
    latitude: -23.2054,
    longitude: -65.3505,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Humahuaca",
      "https://es.wikipedia.org/wiki/Monumento_a_los_H%C3%A9roes_de_la_Independencia",
      "https://whc.unesco.org/en/list/1116/",
    ],
  },
];

export function getPlace(id: string | null | undefined): AndinoPlace | undefined {
  return places.find((p) => p.id === (id as PlaceId));
}
