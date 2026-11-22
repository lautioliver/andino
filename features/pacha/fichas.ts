import type { PlaceId } from "@/shared/types";

export interface Source {
  label: string;
  url: string;
}

export interface PlacePhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  credit: string; // autor · licencia
  creditUrl: string;
}

export interface Ficha {
  region: string;
  summary: string; // 2–4 frases
  more: string[];
  photo: PlacePhoto;
  sources: Source[];
  reviewStatus: "borrador";
}

const UNESCO: Source = {
  label: "UNESCO — Quebrada de Humahuaca (Patrimonio Mundial)",
  url: "https://whc.unesco.org/en/list/1116/",
};

// Textos resumidos de las fuentes listadas. Estado: borrador, pendiente de revisión editorial.
export const fichas: Record<PlaceId, Ficha> = {
  purmamarca: {
    region: "Quebrada de Humahuaca · Departamento Tumbaya",
    summary:
      "Purmamarca es un pueblo de la Quebrada de Humahuaca, al pie del Cerro de los Siete Colores. Las franjas de color del cerro son capas de rocas sedimentarias de distintas edades y composiciones que quedaron expuestas por la erosión.",
    more: [
      "La Quebrada de Humahuaca, el valle por el que pasa el recorrido, fue declarada Patrimonio Mundial por la UNESCO en 2003 como paisaje cultural.",
      "Ese reconocimiento destaca su uso como ruta de intercambio y comunicación durante unos 10.000 años.",
    ],
    photo: {
      src: "/places/purmamarca.jpg",
      width: 1280,
      height: 960,
      alt: "Cerro de los Siete Colores con franjas rojizas y el pueblo de Purmamarca al pie",
      credit: "Augusto Sarita · CC BY-SA 3.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Cerro_de_los_siete_colores.jpg",
    },
    sources: [
      { label: "Wikipedia — Purmamarca", url: "https://es.wikipedia.org/wiki/Purmamarca" },
      { label: "Wikipedia — Cerro de los Siete Colores", url: "https://es.wikipedia.org/wiki/Cerro_de_los_Siete_Colores" },
      UNESCO,
    ],
    reviewStatus: "borrador",
  },
  tilcara: {
    region: "Quebrada de Humahuaca · Departamento Tilcara",
    summary:
      "Cerca de Tilcara está el Pucará de Tilcara, un sitio arqueológico formado por construcciones de los tilcaras, una parcialidad de los omaguacas. Está sobre un morro de unos 80 metros, en un punto estratégico de la Quebrada, a 1 km al sur de la ciudad.",
    more: [
      "El sitio está junto a la confluencia del río Huasamayo y el río Grande, a unos 2450 m s. n. m.",
      "Forma parte del paisaje cultural de la Quebrada de Humahuaca, Patrimonio Mundial de la UNESCO desde 2003.",
    ],
    photo: {
      src: "/places/tilcara.jpg",
      width: 800,
      height: 600,
      alt: "Construcciones de piedra del Pucará de Tilcara rodeadas de cardones",
      credit: "Marianocecowski · CC BY-SA 3.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Jujuy-Tilcara-Pucara-P3130012.JPG",
    },
    sources: [
      { label: "Wikipedia — Tilcara", url: "https://es.wikipedia.org/wiki/Tilcara" },
      { label: "Wikipedia — Pucará de Tilcara", url: "https://es.wikipedia.org/wiki/Pucar%C3%A1_de_Tilcara" },
      UNESCO,
    ],
    reviewStatus: "borrador",
  },
  humahuaca: {
    region: "Quebrada de Humahuaca · Departamento Humahuaca",
    summary:
      "Humahuaca es la cabecera del departamento homónimo, a 2939 m s. n. m. sobre la RN 9. Hasta fines del siglo XIX fue uno de los centros comerciales coloniales más importantes del antiguo camino al Alto Perú.",
    more: [
      "En la ciudad está el Monumento a los Héroes de la Independencia, un grupo escultórico aprobado por ley del Congreso en 1925 e inaugurado en 1950. Es Monumento Histórico Nacional.",
      "La Quebrada que lleva su nombre es Patrimonio Mundial de la UNESCO desde 2003.",
    ],
    photo: {
      src: "/places/humahuaca.jpg",
      width: 1280,
      height: 1920,
      alt: "Escalinata de piedra que sube al Monumento a los Héroes de la Independencia en Humahuaca",
      credit: "nathalie_r · CC BY 2.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Humahuaca_(4322489621).jpg",
    },
    sources: [
      { label: "Wikipedia — Humahuaca", url: "https://es.wikipedia.org/wiki/Humahuaca" },
      {
        label: "Wikipedia — Monumento a los Héroes de la Independencia",
        url: "https://es.wikipedia.org/wiki/Monumento_a_los_H%C3%A9roes_de_la_Independencia",
      },
      UNESCO,
    ],
    reviewStatus: "borrador",
  },
};
