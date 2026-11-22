import type { AndinoPlace, PlaceId } from "@/shared/types";

// Fuente única de lugares para Pacha y Cielo: las paradas del Tren Solar de la Quebrada, en el orden del recorrido
// (Anexo V del Tren Solar, 2025, más el apeadero El Bayeh, inaugurado en marzo de 2026). Coordenadas de Wikipedia
// (El Bayeh: la ficha de la bodega en Google Maps), suficientes para el cálculo astronómico.
export const places: AndinoPlace[] = [
  {
    id: "volcan",
    name: "Volcán",
    latitude: -23.918,
    longitude: -65.4653,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Volc%C3%A1n_(Jujuy)",
      "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf",
    ],
  },
  {
    id: "tumbaya",
    name: "Tumbaya",
    latitude: -23.8575,
    longitude: -65.467,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Tumbaya",
      "https://commons.wikimedia.org/wiki/File:Capilla_del_Pueblo_de_Tumbaya.jpg",
      "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf",
    ],
  },
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
    id: "hornillos",
    name: "Posta de Hornillos",
    latitude: -23.6542,
    longitude: -65.4311,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Posta_de_Hornillos",
      "https://es.wikipedia.org/wiki/Maimar%C3%A1",
      "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf",
    ],
  },
  {
    id: "maimara",
    name: "Maimará",
    latitude: -23.6261,
    longitude: -65.4091,
    sourceUrls: [
      "https://es.wikipedia.org/wiki/Maimar%C3%A1",
      "https://tourism-villages.unwto.org/en/villages/maimara/",
      "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf",
    ],
  },
  {
    id: "elbayeh",
    name: "El Bayeh",
    latitude: -23.612,
    longitude: -65.406,
    sourceUrls: [
      "https://bodegaelbayeh.com.ar/turismo/",
      "https://bodegaelbayeh.com.ar/fincas/",
      "https://las24horasdejujuy.com.ar/el-tren-solar-de-la-quebrada-suma-una-nueva-parada-en-la-bodega-el-bayeh/",
      "https://www.paginacentral.com.ar/jujuy/el-tren-solar-suma-una-nueva-parada-en-maimara-y-refuerza-la-ruta-del-vino-jujena/",
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
];

export function getPlace(id: string | null | undefined): AndinoPlace | undefined {
  return places.find((p) => p.id === (id as PlaceId));
}
