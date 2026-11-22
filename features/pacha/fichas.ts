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
  /** Cómo se ve el lugar, para la IA, cuando la foto de la ficha no lo muestra (si falta, se usa photo.alt). */
  aspecto?: string;
  /** Inglés: los mismos textos, sin datos nuevos. */
  en: { region: string; summary: string; more: string[]; alt: string };
}

/** Textos de la ficha en el idioma de la interfaz (foto, fuentes y estado no cambian). */
export function fichaEn(f: Ficha, lang: "es" | "en"): Ficha {
  if (lang === "es") return f;
  return { ...f, region: f.en.region, summary: f.en.summary, more: f.en.more, photo: { ...f.photo, alt: f.en.alt } };
}

const UNESCO: Source = {
  label: "UNESCO — Quebrada de Humahuaca (Patrimonio Mundial)",
  url: "https://whc.unesco.org/en/list/1116/",
};

// Textos resumidos de las fuentes listadas. Estado: borrador, pendiente de revisión editorial.
export const fichas: Record<PlaceId, Ficha> = {
  volcan: {
    region: "Quebrada de Humahuaca · Departamento Tumbaya",
    summary:
      "Volcán es la primera localidad de la Quebrada de Humahuaca para quien sube hacia el norte por la Ruta Nacional 9. Acá arranca el Tren Solar: en la estación están los talleres y el depósito de las unidades. Alrededor, los cerros pasan del verde del monte a laderas desnudas en tonos ocres y rojos.",
    more: [
      "El pueblo nació en 1905 con el tendido del ferrocarril que subió la Quebrada; su estación tuvo un importante taller de reparaciones. El nombre viene de los aludes de barro y piedra que bajan por el arroyo del Medio en las lluvias de verano y que recuerdan a una colada de lava.",
      "El 3 de abril de 1813, durante la guerra de la Independencia, las milicias de Alejandro Burela derrotaron acá a las fuerzas realistas de Pedro Antonio Olañeta, en el combate de Volcán. Hoy parte de las viejas instalaciones del Ferrocarril Belgrano aloja la Feria Campesina de Artesanos de la Quebrada y Puna.",
    ],
    photo: {
      src: "/places/volcan.jpg",
      width: 1280,
      height: 854,
      alt: "El Tren Solar, blanco con franja roja, detenido en el andén de Volcán junto al cartel negro con el nombre de la estación, con galpones de ladrillo y cerros detrás a contraluz",
      credit: "Argentina.gob.ar · CC BY 4.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Tren_solar_en_estacion_volcan.jpg",
    },
    sources: [
      { label: "Wikipedia — Volcán (Jujuy)", url: "https://es.wikipedia.org/wiki/Volc%C3%A1n_(Jujuy)" },
      { label: "Tren Solar de la Quebrada — Anexo V, Programa actual de servicios", url: "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf" },
    ],
    reviewStatus: "borrador",
    en: {
      region: "Quebrada de Humahuaca · Tumbaya Department",
      summary:
        "Volcán is the first town in the Quebrada de Humahuaca when you head north on National Route 9. It is where the Solar Train starts: the station houses the workshops and the depot for the trains. Around it, the hills shift from green scrub to bare slopes in ochre and red.",
      more: [
        "The town was born in 1905 with the railway that climbed the Quebrada, and its station had a major repair workshop. Its name comes from the mud and rock slides that come down the Arroyo del Medio during summer rains, which resemble a lava flow.",
        "On 3 April 1813, during the War of Independence, Alejandro Burela's militias defeated the royalist forces of Pedro Antonio Olañeta here, in the Combat of Volcán. Today part of the old Belgrano Railway buildings houses the Feria Campesina, a craft fair for artisans from the Quebrada and the Puna.",
      ],
      alt: "The Solar Train, white with a red stripe, stopped at the Volcán platform next to the black station name sign, with brick sheds and backlit hills behind",
    },
  },
  tumbaya: {
    region: "Quebrada de Humahuaca · Departamento Tumbaya",
    summary:
      "Tumbaya es un pueblo chico a orillas del río Grande, a unos 2030 m de altura, rodeado de cerros de colores. Lo que más se reconoce es su iglesia colonial, Monumento Histórico Nacional.",
    more: [
      "La iglesia guarda pinturas de la Escuela Cuzqueña y piezas de orfebrería. El pueblo celebra a la Virgen de la Candelaria el 2 de febrero y a Nuestra Señora de los Dolores el 15 de septiembre, con feria popular.",
      "Tumbaya está ligada a la peregrinación de la Virgen de Copacabana de Punta Corral, un santuario a 23 km al noreste del pueblo: hasta 1917 la imagen bajaba a Tumbaya el Domingo de Ramos. En 2017 un alud bajó de los cerros vecinos y cubrió de barro y piedras a Tumbaya y a Volcán.",
    ],
    photo: {
      src: "/places/tumbaya.jpg",
      width: 1280,
      height: 853,
      alt: "Fachada amarilla de la capilla de Tumbaya, con techo de tejas, campanario con cúpula y una cruz alta, delante de cerros rojizos",
      credit: "Luciano Villa Echenique · CC BY-SA 3.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Capilla_del_Pueblo_de_Tumbaya.jpg",
    },
    sources: [
      { label: "Wikipedia — Tumbaya", url: "https://es.wikipedia.org/wiki/Tumbaya" },
      { label: "Wikimedia Commons — Capilla de Tumbaya (Monumento Argentino 671)", url: "https://commons.wikimedia.org/wiki/File:Capilla_del_Pueblo_de_Tumbaya.jpg" },
      { label: "Tren Solar de la Quebrada — Anexo V, Programa actual de servicios", url: "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf" },
    ],
    reviewStatus: "borrador",
    en: {
      region: "Quebrada de Humahuaca · Tumbaya Department",
      summary:
        "Tumbaya is a small village on the banks of the Río Grande, at about 2,030 m, surrounded by colourful hills. Its best-known sight is its colonial church, a National Historic Monument.",
      more: [
        "The church holds paintings from the Cusco School and silverwork pieces. The village celebrates the Virgin of Candelaria on 2 February and Our Lady of Sorrows on 15 September, with a popular fair.",
        "Tumbaya is tied to the pilgrimage of the Virgin of Copacabana of Punta Corral, a sanctuary 23 km northeast of the village: until 1917 the image came down to Tumbaya on Palm Sunday. In 2017 a mudslide from the nearby hills buried Tumbaya and Volcán under mud and rock.",
      ],
      alt: "Yellow façade of the Tumbaya chapel, with a tiled roof, a domed bell tower and a tall cross, in front of reddish hills",
    },
  },
  hornillos: {
    region: "Quebrada de Humahuaca · Departamento Tilcara",
    summary:
      "La Posta de Hornillos es una posta de la época colonial, construida en 1772, a unos 3 km de la entrada sur de Maimará sobre la Ruta 9. Desde 1979 funciona como museo histórico, y el Tren Solar tiene un apeadero junto a ella.",
    more: [
      "La posta se creó por disposición del visitador Alonso Carrió de la Vandera y fue paso obligado de quienes viajaban entre Potosí y Buenos Aires. Después de 1810 fue uno de los cuarteles del Ejército del Norte, al mando del coronel Manuel Álvarez Prado, y en 1813 descansó allí Manuel Belgrano.",
      "El museo recrea la vida de siglos pasados en tres secciones: el origen de las postas, la guerra de la Independencia y los medios de transporte. Muy cerca está el Antigal de Hornillos, un sitio arqueológico que solo se visita con guía.",
    ],
    photo: {
      src: "/places/hornillos.jpg",
      width: 1280,
      height: 853,
      alt: "La capilla blanca de la Posta de Hornillos, con campanario de cúpula rosada, detrás de una pirca de piedra, entre árboles y bajo cerros pelados y cielo azul",
      credit: "miroab · CC BY-SA 2.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:122-Capilla_de_la_Posta_de_Hornillos_Tilcara.jpg",
    },
    sources: [
      { label: "Wikipedia — Posta de Hornillos", url: "https://es.wikipedia.org/wiki/Posta_de_Hornillos" },
      { label: "Wikipedia — Maimará", url: "https://es.wikipedia.org/wiki/Maimar%C3%A1" },
      { label: "Tren Solar de la Quebrada — Anexo V, Programa actual de servicios", url: "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf" },
    ],
    reviewStatus: "borrador",
    en: {
      region: "Quebrada de Humahuaca · Tilcara Department",
      summary:
        "The Posta de Hornillos is a colonial-era staging post built in 1772, about 3 km from the southern entrance to Maimará on Route 9. It has been a history museum since 1979, and the Solar Train has a halt right next to it.",
      more: [
        "The post was set up on the orders of inspector Alonso Carrió de la Vandera and was an obligatory stop for travellers between Potosí and Buenos Aires. After 1810 it became one of the headquarters of the Army of the North, under Colonel Manuel Álvarez Prado, and in 1813 Manuel Belgrano rested there.",
        "The museum recreates life in past centuries in three sections: the origin of staging posts, the War of Independence and means of transport. Nearby is the Antigal de Hornillos, an archaeological site that can only be visited with a guide.",
      ],
      alt: "The white chapel of the Posta de Hornillos, with a pink-domed bell tower, behind a dry-stone wall, among trees and under bare hills and a blue sky",
    },
  },
  maimara: {
    region: "Quebrada de Humahuaca · Departamento Tilcara",
    summary:
      "Maimará es un pueblo agrícola de la Quebrada, a 2334 m, junto al río Grande. Detrás se levanta la Paleta del Pintor, un cerro de franjas de colores, y a la entrada norte está su cementerio, colorido y en lo alto de una loma.",
    more: [
      "La Paleta del Pintor son plegamientos de los períodos terciario y cuaternario que muestran capas de distintos colores. Según la gente mayor del lugar, el cementerio está en altura para acercarlo al Tata Inti; algunas bóvedas de principios del siglo XX tienen remates apuntados, curvos y mixtilíneos.",
      "Cerca del pueblo hay sitios prehispánicos como el Antigal Iruyto, que los maimareños consideran sagrado, y quedan la iglesia colonial de Nuestra Señora de la Candelaria y el Molino de Chicapa, de 1888. En 2025, ONU Turismo la eligió entre los Best Tourism Villages.",
    ],
    photo: {
      src: "/places/maimara.jpg",
      width: 1280,
      height: 854,
      alt: "El cementerio de Maimará sobre una loma, con bóvedas blancas y un cardón, al pie del cerro Paleta del Pintor de franjas rojizas, moradas, ocres y verdosas",
      credit: "Matthias Bethke · CC BY-SA 4.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:20170818_Friedhof_von_Maimara.jpg",
    },
    sources: [
      { label: "Wikipedia — Maimará", url: "https://es.wikipedia.org/wiki/Maimar%C3%A1" },
      { label: "ONU Turismo — Best Tourism Villages: Maimará", url: "https://tourism-villages.unwto.org/en/villages/maimara/" },
      { label: "Tren Solar de la Quebrada — Anexo V, Programa actual de servicios", url: "https://trensolar.com.ar/wp-content/uploads/2025/07/Anexo-5-Programa-actual-de-Servicios-1.pdf" },
    ],
    reviewStatus: "borrador",
    en: {
      region: "Quebrada de Humahuaca · Tilcara Department",
      summary:
        "Maimará is a farming village in the Quebrada, at 2,334 m, next to the Río Grande. Behind it rises the Paleta del Pintor (Painter's Palette), a hillside of coloured bands, and at the northern entrance sits its colourful cemetery on top of a hill.",
      more: [
        "The Paleta del Pintor is made of Tertiary and Quaternary folds that expose layers of different colours. According to the village elders, the cemetery sits up high to bring it closer to Tata Inti, the Sun; some early-20th-century vaults have pointed, curved and mixtilinear tops.",
        "Near the village are pre-Hispanic sites such as the Antigal Iruyto, which locals consider sacred, along with the colonial church of Nuestra Señora de la Candelaria and the Chicapa mill, built in 1888. In 2025, UN Tourism named it one of the Best Tourism Villages.",
      ],
      alt: "Maimará cemetery on a hill, with white vaults and a cardón cactus, at the foot of the Paleta del Pintor with reddish, purple, ochre and greenish bands",
    },
  },
  elbayeh: {
    region: "Quebrada de Humahuaca · Departamento Tilcara · Ruta del Vino de Jujuy",
    summary:
      "El Bayeh es una bodega de la familia Manzur en Maimará, del lado de Tilcara, y desde marzo de 2026 tiene su propio apeadero del Tren Solar: es la primera bodega de la zona con acceso directo desde las vías. Sus viñedos, en la Finca Ollantay, están a 2400 m, frente a la Paleta del Pintor.",
    more: [
      "La Finca Ollantay la compró el abuelo Pedro Manzur en 1971; en 2018 la familia decidió hacer vino y en 2020 nació la marca. Ahí crecen malbec, syrah, chardonnay, semillón y criolla chica, y parte del vino se elabora en ánforas de arcilla traídas de España.",
      "La bodega construyó el apeadero, y la idea es bajar, quedarse unas horas entre los viñedos con una degustación o una caminata, y seguir viaje en un tren posterior. Las visitas guiadas son con reserva previa. Es una de las paradas del Tren del Vino, la salida del Tren Solar dedicada a la Ruta del Vino de Jujuy.",
    ],
    photo: {
      src: "/places/elbayeh.jpg",
      width: 1280,
      height: 720,
      alt: "El Tren Solar, blanco con franja roja, pasando por el tramo de Maimará entre cerros rojizos erosionados y cardones, junto a la Ruta 9 (no es la bodega)",
      credit: "Argentina.gob.ar · CC BY 4.0",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Tren_de_la_quebrada_01.jpg",
    },
    aspecto:
      "Hileras de parras en el llano del valle, un galpón de bodega y, de fondo, la Paleta del Pintor de Maimará. Sin viñedos a la vista no hay cómo distinguirla de Maimará",
    sources: [
      { label: "Bodega El Bayeh — Turismo", url: "https://bodegaelbayeh.com.ar/turismo/" },
      { label: "Bodega El Bayeh — Fincas", url: "https://bodegaelbayeh.com.ar/fincas/" },
      { label: "Bodega El Bayeh — Familia", url: "https://bodegaelbayeh.com.ar/familia/" },
      { label: "Las 24 Horas de Jujuy — El Tren Solar suma una nueva parada en la bodega El Bayeh (marzo de 2026)", url: "https://las24horasdejujuy.com.ar/el-tren-solar-de-la-quebrada-suma-una-nueva-parada-en-la-bodega-el-bayeh/" },
      { label: "Página Central — El Tren Solar suma una nueva parada en Maimará (marzo de 2026)", url: "https://www.paginacentral.com.ar/jujuy/el-tren-solar-suma-una-nueva-parada-en-maimara-y-refuerza-la-ruta-del-vino-jujena/" },
      { label: "Canal 26 — El Tren Solar estrena una parada entre viñedos (abril de 2026)", url: "https://www.canal26.com/turismo/2026/04/12/el-tren-solar-de-la-quebrada-estrena-una-parada-entre-vinedos-y-suma-una-nueva-experiencia-para-recorrer-jujuy/" },
    ],
    reviewStatus: "borrador",
    en: {
      region: "Quebrada de Humahuaca · Tilcara Department · Jujuy Wine Route",
      summary:
        "El Bayeh is a winery owned by the Manzur family in Maimará, on the Tilcara side, and since March 2026 it has its own Solar Train halt: it is the first winery in the area with direct access from the tracks. Its vineyards, on the Finca Ollantay estate, lie at 2,400 m, facing the Paleta del Pintor.",
      more: [
        "Grandfather Pedro Manzur bought the Finca Ollantay in 1971; in 2018 the family decided to make wine and the brand was born in 2020. Malbec, Syrah, Chardonnay, Sémillon and Criolla Chica grow there, and part of the wine is made in clay amphorae brought from Spain.",
        "The winery built the halt, and the idea is to get off, spend a few hours among the vines with a tasting or a walk, and continue on a later train. Guided visits require booking ahead. It is one of the stops of the Tren del Vino (Wine Train), the Solar Train's outing devoted to the Jujuy Wine Route.",
      ],
      alt: "The Solar Train, white with a red stripe, running through the Maimará stretch among eroded reddish hills and cardón cacti, next to Route 9 (not the winery)",
    },
  },
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
    en: {
      region: "Quebrada de Humahuaca · Tumbaya Department",
      summary:
        "Purmamarca is a village in the Quebrada de Humahuaca, at the foot of the Cerro de los Siete Colores (Hill of Seven Colours). The hill's bands of colour are layers of sedimentary rock of different ages and compositions, exposed by erosion.",
      more: [
        "The Quebrada de Humahuaca, the valley the route runs through, was declared a UNESCO World Heritage Site in 2003 as a cultural landscape.",
        "That recognition highlights its use as a route for trade and communication for some 10,000 years.",
      ],
      alt: "The Cerro de los Siete Colores with reddish bands and the village of Purmamarca at its foot",
    },
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
    en: {
      region: "Quebrada de Humahuaca · Tilcara Department",
      summary:
        "Near Tilcara lies the Pucará de Tilcara, an archaeological site made up of buildings of the Tilcaras, a subgroup of the Omaguacas. It stands on a hill about 80 metres high, at a strategic point in the Quebrada, 1 km south of the town.",
      more: [
        "The site sits beside the confluence of the Huasamayo and Grande rivers, at about 2,450 m above sea level.",
        "It is part of the cultural landscape of the Quebrada de Humahuaca, a UNESCO World Heritage Site since 2003.",
      ],
      alt: "Stone buildings of the Pucará de Tilcara surrounded by cardón cacti",
    },
  },
};
