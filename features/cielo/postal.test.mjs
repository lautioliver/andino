// Tests de la «Postal de tu noche» (la leyenda, el archivo, el enlace y las medidas): `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { momentoDesdeURL, queryCielo } from "./cielo.ts";
import { enlacePostal, ISOTIPO, LEMA, leyendaPostal, momentoPostal, nombreArchivoPostal, notaPostal, POSTAL, SITIO, tamanioQueEntra, textoPostal } from "./postal.ts";

const NOCHE = "2026-11-23T23:30:00-03:00";
const tilcara = { nombre: "Tilcara", placeId: "tilcara" };
const hornillos = { nombre: "Posta de Hornillos", placeId: "hornillos" };
const cercaDeMaimara = { nombre: "Maimará", placeId: "maimara", cerca: true };
const lejos = { nombre: null, placeId: null };
const ORIGEN = "https://andino-neon.vercel.app";

describe("momentoPostal", () => {
  it("la fecha y la hora, escritas en español", () => {
    assert.deepEqual(momentoPostal(NOCHE, "es"), { fecha: "2026-11-23", hora: "23:30", texto: "23 de noviembre de 2026 · 23:30" });
  });

  it("y en inglés: cambia el texto, no la fecha ni la hora que van al enlace", () => {
    assert.deepEqual(momentoPostal(NOCHE, "en"), { fecha: "2026-11-23", hora: "23:30", texto: "November 23, 2026 · 23:30" });
  });

  it("siempre en hora de Argentina, venga el instante con la zona que venga", () => {
    for (const iso of ["2026-11-24T02:30:00Z", "2026-11-24T03:30:00+01:00", "2026-11-23T18:30:00-08:00", "2026-11-24T02:30:00.000Z"]) {
      assert.equal(momentoPostal(iso, "es").texto, "23 de noviembre de 2026 · 23:30", iso);
    }
  });

  it("cerca de la medianoche no se corre de día, de mes ni de año", () => {
    assert.equal(momentoPostal("2027-01-01T02:59:00Z", "es").texto, "31 de diciembre de 2026 · 23:59");
    assert.equal(momentoPostal("2027-01-01T03:00:00Z", "es").texto, "1 de enero de 2027 · 00:00");
    assert.equal(momentoPostal("2027-01-01T03:00:00Z", "en").texto, "January 1, 2027 · 00:00");
    assert.equal(momentoPostal("2027-01-01T03:00:00Z", "es").fecha, "2027-01-01");
  });

  it("el día va sin cero adelante; la hora, con él", () => {
    assert.equal(momentoPostal("2026-06-05T04:07:00-03:00", "es").texto, "5 de junio de 2026 · 04:07");
    assert.equal(momentoPostal("2026-06-05T04:07:00-03:00", "en").texto, "June 5, 2026 · 04:07");
  });

  it("los doce meses, en los dos idiomas", () => {
    const es = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const en = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    for (let m = 0; m < 12; m++) {
      const iso = `2026-${String(m + 1).padStart(2, "0")}-15T21:00:00-03:00`;
      assert.equal(momentoPostal(iso, "es").texto, `15 de ${es[m]} de 2026 · 21:00`);
      assert.equal(momentoPostal(iso, "en").texto, `${en[m]} 15, 2026 · 21:00`);
    }
  });

  it("un instante que no es una fecha no se dibuja: falla", () => {
    assert.throws(() => momentoPostal("mañana a la noche", "es"), { name: "RangeError", message: "Instante no válido: mañana a la noche" });
    assert.throws(() => momentoPostal("", "en"), { name: "RangeError", message: "Instante no válido: " });
  });
});

describe("leyendaPostal", () => {
  it("una parada: «El cielo de Tilcara · 23 de noviembre de 2026 · 23:30»", () => {
    const l = leyendaPostal(tilcara, NOCHE, "es");
    assert.deepEqual(l, { rotulo: "El cielo de", lugar: "Tilcara", momento: "23 de noviembre de 2026 · 23:30", frase: "El cielo de Tilcara" });
    assert.equal(`${l.frase} · ${l.momento}`, "El cielo de Tilcara · 23 de noviembre de 2026 · 23:30");
  });

  it("en inglés el nombre del lugar queda en español", () => {
    assert.deepEqual(leyendaPostal(hornillos, NOCHE, "en"), {
      rotulo: "The sky over",
      lugar: "Posta de Hornillos",
      momento: "November 23, 2026 · 23:30",
      frase: "The sky over Posta de Hornillos",
    });
  });

  it("desde la ubicación del teléfono no dice que es el cielo de la parada, sino de cerca", () => {
    assert.equal(leyendaPostal(cercaDeMaimara, NOCHE, "es").frase, "El cielo cerca de Maimará");
    assert.equal(leyendaPostal(cercaDeMaimara, NOCHE, "en").frase, "The sky near Maimará");
    assert.equal(leyendaPostal(cercaDeMaimara, NOCHE, "es").lugar, "Maimará");
  });

  it("lejos del recorrido no nombra ninguna parada", () => {
    assert.deepEqual(leyendaPostal(lejos, NOCHE, "es"), { rotulo: "El cielo desde", lugar: "Mi ubicación", momento: "23 de noviembre de 2026 · 23:30", frase: "El cielo desde mi ubicación" });
    assert.deepEqual(leyendaPostal(lejos, NOCHE, "en"), { rotulo: "The sky from", lugar: "My location", momento: "November 23, 2026 · 23:30", frase: "The sky from my location" });
  });
});

describe("notaPostal", () => {
  it("dice que es un cielo calculado y no una foto, en los dos idiomas", () => {
    assert.equal(notaPostal(false, "es"), "Cielo calculado, no una foto");
    assert.equal(notaPostal(false, "en"), "Calculated sky, not a photo");
  });

  it("con luz, además avisa que las estrellas no se ven", () => {
    assert.equal(notaPostal(true, "es"), "Cielo calculado, no una foto · con esta luz las estrellas no se ven");
    assert.equal(notaPostal(true, "en"), "Calculated sky, not a photo · in this light the stars can't be seen");
  });
});

describe("nombreArchivoPostal", () => {
  it("lugar, fecha y hora de Argentina: se ordena solo por fecha", () => {
    assert.equal(nombreArchivoPostal(tilcara, NOCHE), "andino-cielo-tilcara-2026-11-23-2330.png");
    assert.equal(nombreArchivoPostal(tilcara, "2026-11-24T02:30:00Z"), "andino-cielo-tilcara-2026-11-23-2330.png");
  });

  it("sin espacios, tildes ni mayúsculas", () => {
    assert.equal(nombreArchivoPostal(hornillos, NOCHE), "andino-cielo-posta-de-hornillos-2026-11-23-2330.png");
    assert.equal(nombreArchivoPostal(cercaDeMaimara, NOCHE), "andino-cielo-maimara-2026-11-23-2330.png");
    assert.equal(nombreArchivoPostal({ nombre: "Volcán", placeId: "volcan" }, NOCHE), "andino-cielo-volcan-2026-11-23-2330.png");
    assert.equal(nombreArchivoPostal({ nombre: "El Bayeh", placeId: "elbayeh" }, NOCHE), "andino-cielo-el-bayeh-2026-11-23-2330.png");
  });

  it("sin lugar con nombre, solo el momento", () => {
    assert.equal(nombreArchivoPostal(lejos, NOCHE), "andino-cielo-2026-11-23-2330.png");
  });

  it("nunca lleva barras, puntos de más ni guiones dobles, venga el nombre que venga", () => {
    for (const nombre of ["../../etc/passwd", "Ñandú & Cía. / 2", "  ", "///", "a\\b:c*d?", "cielo 🌌 andino", "--x--", "A".repeat(300) + "/"]) {
      const archivo = nombreArchivoPostal({ nombre, placeId: null }, NOCHE);
      assert.match(archivo, /^andino-cielo-(?:[a-z0-9]+-)*2026-11-23-2330\.png$/, nombre);
    }
    assert.equal(nombreArchivoPostal({ nombre: "///", placeId: null }, NOCHE), "andino-cielo-2026-11-23-2330.png");
  });

  it("un nombre larguísimo se corta: el archivo se puede guardar en cualquier teléfono", () => {
    assert.equal(nombreArchivoPostal({ nombre: "A".repeat(300), placeId: null }, NOCHE), `andino-cielo-${"a".repeat(40)}-2026-11-23-2330.png`);
    // El corte no deja un guion colgando ni uno doble.
    assert.equal(nombreArchivoPostal({ nombre: `${"b".repeat(39)} y más`, placeId: null }, NOCHE), `andino-cielo-${"b".repeat(39)}-2026-11-23-2330.png`);
    assert.equal(nombreArchivoPostal({ nombre: `${"c".repeat(40)} y más`, placeId: null }, NOCHE), `andino-cielo-${"c".repeat(40)}-2026-11-23-2330.png`);
  });
});

describe("enlacePostal", () => {
  it("lleva a /cielo con placeId, fecha y hora", () => {
    assert.equal(enlacePostal(ORIGEN, tilcara, NOCHE), "https://andino-neon.vercel.app/cielo?placeId=tilcara&fecha=2026-11-23&hora=23%3A30");
  });

  it("son los parámetros que /cielo ya respeta: los de queryCielo, y momentoDesdeURL los acepta", () => {
    for (const iso of [NOCHE, "2026-06-21T21:00:00-03:00", "2027-01-01T02:59:00Z", "2026-11-23T03:05:00-03:00"]) {
      const url = new URL(enlacePostal(ORIGEN, hornillos, iso));
      const { fecha, hora } = momentoPostal(iso, "es");
      assert.equal(url.origin, ORIGEN);
      assert.equal(url.pathname, "/cielo");
      assert.equal(url.search, queryCielo("hornillos", { fecha, hora }));
      assert.deepEqual(momentoDesdeURL(url.searchParams.get("fecha"), url.searchParams.get("hora")), { fecha, hora });
      assert.equal(url.searchParams.get("placeId"), "hornillos");
    }
  });

  it("el momento del enlace es el de Argentina, no el de la zona con la que vino escrito", () => {
    const url = new URL(enlacePostal(ORIGEN, tilcara, "2026-11-24T02:30:00Z"));
    assert.equal(url.searchParams.get("fecha"), "2026-11-23");
    assert.equal(url.searchParams.get("hora"), "23:30");
  });

  it("sin parada, solo el momento: ni placeId ni coordenadas", () => {
    const url = new URL(enlacePostal(ORIGEN, lejos, NOCHE));
    assert.deepEqual([...url.searchParams.keys()], ["fecha", "hora"]);
    assert.equal(url.search, "?fecha=2026-11-23&hora=23%3A30");
  });

  it("un placeId raro viaja codificado: no agrega parámetros ni cambia de ruta", () => {
    const raro = "tilcara&hora=00:00#x/../y";
    const url = new URL(enlacePostal(ORIGEN, { nombre: "Tilcara", placeId: raro }, NOCHE));
    assert.equal(url.pathname, "/cielo");
    assert.equal(url.hash, "");
    assert.deepEqual([...url.searchParams.keys()], ["placeId", "fecha", "hora"]);
    assert.equal(url.searchParams.get("placeId"), raro);
    assert.equal(url.searchParams.get("hora"), "23:30");
  });
});

describe("textoPostal", () => {
  it("el título nombra el cielo y la app", () => {
    assert.equal(textoPostal(tilcara, NOCHE, "es", ORIGEN).titulo, "El cielo de Tilcara · ANDINO");
    assert.equal(textoPostal(hornillos, NOCHE, "en", ORIGEN).titulo, "The sky over Posta de Hornillos · ANDINO");
  });

  it("el texto dice de dónde y de cuándo es, que no es una foto, y termina con el enlace a ese cielo", () => {
    assert.equal(
      textoPostal(tilcara, NOCHE, "es", ORIGEN).texto,
      "El cielo de Tilcara · 23 de noviembre de 2026 · 23:30 (hora de Argentina). Es el cielo calculado, no una foto. Miralo en ANDINO: https://andino-neon.vercel.app/cielo?placeId=tilcara&fecha=2026-11-23&hora=23%3A30",
    );
    assert.equal(
      textoPostal(tilcara, NOCHE, "en", ORIGEN).texto,
      "The sky over Tilcara · November 23, 2026 · 23:30 (Argentina time). A calculated sky, not a photo. See it in ANDINO: https://andino-neon.vercel.app/cielo?placeId=tilcara&fecha=2026-11-23&hora=23%3A30",
    );
  });

  it("el enlace es el de enlacePostal, con el origen que le pasan, y va al final para que se pueda tocar", () => {
    for (const lugar of [tilcara, cercaDeMaimara, lejos]) {
      for (const lang of ["es", "en"]) {
        const { texto } = textoPostal(lugar, NOCHE, lang, "http://localhost:3109");
        const enlace = enlacePostal("http://localhost:3109", lugar, NOCHE);
        assert.ok(texto.endsWith(` ${enlace}`), texto);
        assert.equal(texto.split("http").length, 2, "un solo enlace");
      }
    }
  });
});

describe("POSTAL: medidas de la composición", () => {
  const { ancho, alto, margen, cielo, filete, pie } = POSTAL;
  // Altura de las mayúsculas y largo de los descendentes, como fracción del tamaño de letra (aproximados, por exceso).
  const MAYUSCULA = 0.75;
  const DESCENDENTE = 0.25;
  const lineas = [POSTAL.rotulo, POSTAL.lugar, POSTAL.momento, POSTAL.marca, POSTAL.sitio, POSTAL.nota];

  it("un PNG vertical de 1080 × 1350 (4:5)", () => {
    assert.equal(ancho, 1080);
    assert.equal(alto, 1350);
    assert.equal(ancho / alto, 4 / 5);
  });

  it("cielo, filete y pie cubren la imagen de arriba abajo, sin huecos ni encimarse", () => {
    assert.deepEqual([cielo.x, cielo.y, cielo.ancho], [0, 0, ancho]);
    assert.equal(cielo.y + cielo.alto, filete.y);
    assert.equal(filete.y + filete.alto, pie.y);
    assert.equal(pie.y + pie.alto, alto);
    for (const parte of [cielo, filete, pie]) assert.ok(parte.alto > 0);
  });

  it("el cielo es lo principal: más de dos tercios de la imagen", () => {
    assert.ok(cielo.alto / alto > 2 / 3, `${cielo.alto} de ${alto}`);
  });

  it("el dibujo del cielo mide píxeles enteros y abarca un campo no menor que el del teléfono ni mayor que el de /cielo", () => {
    assert.ok(Number.isInteger(cielo.ancho / POSTAL.escalaCielo), "ancho");
    assert.ok(Number.isInteger(cielo.alto / POSTAL.escalaCielo), "alto");
    assert.ok(POSTAL.campoCielo >= 80 && POSTAL.campoCielo <= 100);
  });

  it("las líneas del pie van de arriba abajo sin pisarse y todas dentro del pie, con aire abajo", () => {
    let piso = pie.y;
    for (const l of lineas) {
      assert.ok(l.y - l.tamanio * MAYUSCULA >= piso, `la línea en y=${l.y} pisa la de arriba (${piso})`);
      piso = l.y + l.tamanio * DESCENDENTE;
    }
    assert.ok(piso <= alto - 24, `la última línea termina en ${piso}`);
  });

  it("el isotipo queda dentro del pie, a la altura de «ANDINO» y del sitio", () => {
    const { lado, y } = POSTAL.isotipo;
    assert.ok(y >= POSTAL.momento.y + POSTAL.momento.tamanio * DESCENDENTE, "pisa el momento");
    assert.ok(y + lado <= POSTAL.nota.y - POSTAL.nota.tamanio * MAYUSCULA, "pisa la nota");
    assert.ok(y <= POSTAL.marca.y - POSTAL.marca.tamanio * MAYUSCULA && y + lado >= POSTAL.sitio.y, "no acompaña a la marca");
    assert.ok(margen + lado < ancho / 2);
  });

  it("el lema va en la línea de «ANDINO», enfrente", () => {
    assert.equal(POSTAL.lema.y, POSTAL.marca.y);
  });

  it("se lee en chico: en una miniatura de 270 px, lugar, momento y marca miden 11 px o más", () => {
    const miniatura = 270 / ancho;
    assert.ok(POSTAL.lugar.minimo <= POSTAL.lugar.tamanio);
    for (const [nombre, tamanio] of [["lugar", POSTAL.lugar.minimo], ["momento", POSTAL.momento.tamanio], ["marca", POSTAL.marca.tamanio]]) {
      assert.ok(tamanio * miniatura >= 11, `${nombre}: ${tamanio * miniatura} px`);
    }
    // El resto es letra chica, pero no menos de 24 px en la imagen (unos 9 px a pantalla completa en un teléfono).
    for (const l of [POSTAL.rotulo, POSTAL.sitio, POSTAL.lema, POSTAL.nota]) assert.ok(l.tamanio >= 24);
  });

  it("hay margen a los costados", () => {
    assert.ok(margen >= 48 && margen * 2 < ancho / 4);
  });

  it("lleva el lema en los dos idiomas y el sitio", () => {
    assert.equal(LEMA.es, "Tu mejor noche de cielo en Jujuy");
    assert.equal(LEMA.en, "Your best night under the sky in Jujuy");
    assert.equal(SITIO, "andino-neon.vercel.app");
  });
});

describe("tamanioQueEntra", () => {
  it("si el texto entra, queda como está", () => {
    assert.equal(tamanioQueEntra(400, 92, 952, 60), 92);
    assert.equal(tamanioQueEntra(952, 92, 952, 60), 92);
  });

  it("si no entra, se achica lo justo para entrar", () => {
    const tamanio = tamanioQueEntra(1190, 92, 952, 60);
    assert.equal(tamanio, 73);
    // El ancho de un texto es proporcional al tamaño de letra.
    assert.ok((1190 * tamanio) / 92 <= 952);
    assert.ok((1190 * (tamanio + 1)) / 92 > 952);
  });

  it("nunca baja del mínimo, aunque no entre", () => {
    assert.equal(tamanioQueEntra(5000, 92, 952, 60), 60);
  });

  it("una medida que no es un número no rompe el tamaño", () => {
    assert.equal(tamanioQueEntra(Number.NaN, 92, 952, 60), 92);
    assert.equal(tamanioQueEntra(0, 92, 952, 60), 92);
  });
});

describe("ISOTIPO", () => {
  const svg = readFileSync(new URL("../../public/brand/andino-mark.svg", import.meta.url), "utf8");
  const trazados = [...svg.matchAll(/<path\b[^>]*>/g)].map(([etiqueta]) => {
    const atributo = (nombre) => etiqueta.match(new RegExp(`\\s${nombre}="([^"]*)"`))?.[1];
    return { d: atributo("d"), relleno: atributo("fill"), trazo: atributo("stroke"), grosor: atributo("stroke-width") };
  });

  it("es el de public/brand/andino-mark.svg: los mismos tres trazados, en el mismo orden", () => {
    assert.deepEqual(
      trazados.map((t) => t.d),
      [ISOTIPO.orbita.d, ISOTIPO.estrella.d, ISOTIPO.cumbres.d],
    );
  });

  it("con sus colores: órbita y estrella en Nube, cumbres en Puna", () => {
    const [orbita, estrella, cumbres] = trazados;
    assert.deepEqual([orbita.trazo, orbita.relleno, Number(orbita.grosor)], [ISOTIPO.orbita.color, "none", ISOTIPO.orbita.grosor]);
    assert.equal(estrella.relleno, ISOTIPO.estrella.color);
    assert.equal(cumbres.relleno, ISOTIPO.cumbres.color);
    assert.equal(ISOTIPO.orbita.color, "#fffaf7");
    assert.equal(ISOTIPO.cumbres.color, "#ff7a45");
  });

  it("y en la misma caja", () => {
    assert.match(svg, new RegExp(`viewBox="0 0 ${ISOTIPO.caja} ${ISOTIPO.caja}"`));
  });
});
