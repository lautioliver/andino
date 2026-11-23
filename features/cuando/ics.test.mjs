// Tests del .ics de «Avisame esta noche» (RFC 5545): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { armarIcs, escaparTexto, fechaUTC, plegar } from "./ics.ts";

const octetos = (texto) => Buffer.byteLength(texto, "utf8");
/** Lo que hace un calendario al leer: junta las líneas plegadas. */
const desplegar = (texto) => texto.replace(/\r\n /g, "");
/** Las líneas lógicas del .ics, ya desplegadas. */
const lineas = (ics) => desplegar(ics).split("\r\n");
const valor = (ics, nombre) => lineas(ics).find((l) => l.startsWith(`${nombre}:`))?.slice(nombre.length + 1);
/** Lo inverso de escaparTexto, como lo lee un calendario. */
const leerTexto = (texto) => texto.replace(/\\([\\;,nN])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));

const EVENTO = {
  uid: "cielo-2026-11-28-purmamarca@andino.test",
  creado: Date.UTC(2026, 10, 22, 23, 0, 0),
  inicio: Date.UTC(2026, 10, 29, 0, 20, 0),
  fin: Date.UTC(2026, 10, 29, 1, 20, 0),
  alarmaMin: 30,
  titulo: "Cielo oscuro en Purmamarca",
  descripcion:
    "Cielo oscuro y sin Luna de 21:20 a 00:20 (hora de Argentina).\nEsa noche: Luna gibosa menguante, iluminada al 73 %.\nEl cielo de ese momento: https://andino.test/cielo?placeId=purmamarca&fecha=2026-11-28&hora=21%3A20",
  lugar: "Purmamarca, Jujuy, Argentina",
  geo: { latitude: -23.7333, longitude: -65.4833 },
  url: "https://andino.test/cielo?placeId=purmamarca&fecha=2026-11-28&hora=21%3A20",
};

describe("escapado de texto", () => {
  it("escapa la coma", () => {
    assert.equal(escaparTexto("Purmamarca, Jujuy"), "Purmamarca\\, Jujuy");
  });

  it("escapa el punto y coma", () => {
    assert.equal(escaparTexto("Luna llena; cielo claro"), "Luna llena\\; cielo claro");
  });

  it("escapa la barra invertida, y una sola vez", () => {
    assert.equal(escaparTexto("a\\b"), "a\\\\b");
    assert.equal(escaparTexto("a\\,b"), "a\\\\\\,b");
  });

  it("convierte los saltos de línea de cualquier sistema en \\n", () => {
    assert.equal(escaparTexto("uno\ndos"), "uno\\ndos");
    assert.equal(escaparTexto("uno\r\ndos"), "uno\\ndos");
    assert.equal(escaparTexto("uno\rdos"), "uno\\ndos");
  });

  it("saca los caracteres de control y deja la tabulación", () => {
    assert.equal(escaparTexto("a\u0000b\u0007c\u001bd\u007fe"), "abcde");
    assert.equal(escaparTexto("a\tb"), "a\tb");
  });

  it("lo que escapa se lee de vuelta igual", () => {
    const texto = "De 21:20 a 00:20; Luna al 73 %, sin nubes.\nRuta C:\\cielo\\n";
    assert.equal(leerTexto(escaparTexto(texto)), texto);
  });
});

describe("plegado de líneas", () => {
  it("no toca una línea de hasta 75 octetos", () => {
    const justa = `SUMMARY:${"a".repeat(67)}`;
    assert.equal(octetos(justa), 75);
    assert.equal(plegar(justa), justa);
  });

  it("corta con CRLF y un espacio, y ninguna línea pasa de 75 octetos", () => {
    const larga = `DESCRIPTION:${"abcdefghij".repeat(30)}`;
    const partes = plegar(larga).split("\r\n");
    assert.equal(partes.length, 5);
    assert.equal(octetos(partes[0]), 75);
    for (const p of partes) assert.ok(octetos(p) <= 75, `${octetos(p)} octetos`);
    for (const p of partes.slice(1)) assert.equal(p[0], " ");
    assert.equal(desplegar(plegar(larga)), larga);
  });

  it("con una línea de 76 octetos pasa un solo carácter a la siguiente", () => {
    assert.equal(plegar("a".repeat(76)), `${"a".repeat(75)}\r\n a`);
  });

  it("cuenta octetos y no letras: con acentos corta antes", () => {
    const larga = `DESCRIPTION:${"ñ".repeat(100)}`;
    const partes = plegar(larga).split("\r\n");
    for (const p of partes) assert.ok(octetos(p) <= 75, `${octetos(p)} octetos`);
    assert.ok(partes[0].length < 75);
    assert.equal(desplegar(plegar(larga)), larga);
  });

  it("no corta un carácter por el medio, tampoco los de cuatro octetos", () => {
    // Con distintos largos antes de las lunas, el corte cae en todas las posiciones posibles de un carácter.
    for (let relleno = 0; relleno < 8; relleno++) {
      const larga = `${"a".repeat(relleno)}:${"🌙".repeat(40)}`;
      const plegada = plegar(larga);
      for (const p of plegada.split("\r\n")) {
        assert.ok(octetos(p) <= 75, `${octetos(p)} octetos`);
        assert.ok(p.isWellFormed(), `quedó medio carácter suelto (relleno ${relleno})`);
      }
      assert.equal(desplegar(plegada), larga);
    }
  });
});

describe("el archivo .ics", () => {
  const ics = armarIcs(EVENTO);

  it("termina todas las líneas en CRLF, también la última", () => {
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.equal(ics.replace(/\r\n/g, "").search(/[\r\n]/), -1, "hay un salto que no es CRLF");
  });

  it("ninguna línea física pasa de 75 octetos", () => {
    const fisicas = ics.split("\r\n");
    assert.ok(fisicas.some((l) => l.startsWith(" ")), "este caso necesita una línea plegada");
    for (const l of fisicas) assert.ok(octetos(l) <= 75, `${octetos(l)} octetos: ${l}`);
  });

  it("es un calendario con un evento y una alarma adentro, en ese orden", () => {
    const estructura = lineas(ics).filter((l) => /^(BEGIN|END):/.test(l));
    assert.deepEqual(estructura, ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "BEGIN:VALARM", "END:VALARM", "END:VEVENT", "END:VCALENDAR"]);
    assert.equal(valor(ics, "VERSION"), "2.0");
    assert.ok(valor(ics, "PRODID"));
    assert.equal(valor(ics, "UID"), EVENTO.uid);
  });

  it("escribe las horas en UTC, terminadas en Z, y el evento termina cuando se pide", () => {
    assert.equal(fechaUTC(Date.UTC(2026, 0, 2, 3, 4, 5)), "20260102T030405Z");
    assert.equal(valor(ics, "DTSTAMP"), "20261122T230000Z");
    assert.equal(valor(ics, "DTSTART"), "20261129T002000Z");
    assert.equal(valor(ics, "DTEND"), "20261129T012000Z");
    assert.equal(valor(armarIcs({ ...EVENTO, fin: Date.UTC(2026, 10, 29, 1, 50, 0) }), "DTEND"), "20261129T015000Z");
  });

  it("la alarma avisa los minutos pedidos antes del inicio, mostrando el título", () => {
    const alarma = lineas(ics).slice(lineas(ics).indexOf("BEGIN:VALARM"), lineas(ics).indexOf("END:VALARM"));
    assert.deepEqual(alarma, ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Cielo oscuro en Purmamarca", "TRIGGER:-PT30M"]);
    assert.ok(desplegar(armarIcs({ ...EVENTO, alarmaMin: 45 })).includes("\r\nTRIGGER:-PT45M\r\n"));
  });

  it("título, descripción y lugar van escapados y se leen de vuelta iguales", () => {
    assert.equal(valor(ics, "SUMMARY"), "Cielo oscuro en Purmamarca");
    assert.equal(valor(ics, "LOCATION"), "Purmamarca\\, Jujuy\\, Argentina");
    assert.ok(valor(ics, "DESCRIPTION").startsWith("Cielo oscuro y sin Luna de 21:20 a 00:20 (hora de Argentina).\\nEsa noche: Luna gibosa menguante\\, iluminada al 73 %.\\n"));
    assert.equal(leerTexto(valor(ics, "DESCRIPTION")), EVENTO.descripcion);
    const raro = armarIcs({ ...EVENTO, titulo: "Cielo; oscuro, hoy" });
    assert.equal(valor(raro, "SUMMARY"), "Cielo\\; oscuro\\, hoy");
    assert.ok(lineas(raro).includes("DESCRIPTION:Cielo\\; oscuro\\, hoy"), "la alarma lleva el título sin escapar");
  });

  it("GEO lleva latitud;longitud sin escapar, y URL el enlace entero", () => {
    assert.equal(valor(ics, "GEO"), "-23.7333;-65.4833");
    assert.equal(valor(ics, "URL"), EVENTO.url);
    // Una URI no es texto: sus comas y puntos y coma van tal cual.
    const conComas = "https://andino.test/cielo?lugares=purmamarca,tilcara;orden=1";
    assert.equal(valor(armarIcs({ ...EVENTO, url: conComas }), "URL"), conComas);
  });

  it("un salto de línea en un dato no puede colar una propiedad nueva", () => {
    const hostil = "x\r\nATTENDEE:mailto:otro@example.com\nEND:VCALENDAR";
    const malo = armarIcs({ ...EVENTO, titulo: hostil, descripcion: hostil, lugar: hostil, uid: hostil, url: hostil });
    assert.equal(malo.replace(/\r\n/g, "").search(/[\r\n]/), -1, "hay un salto que no es CRLF");
    const nombres = lineas(malo).map((l) => l.split(":")[0]);
    assert.ok(!nombres.includes("ATTENDEE"), "se coló ATTENDEE");
    assert.equal(nombres.filter((n) => n === "END").length, 3);
    assert.equal(valor(malo, "SUMMARY"), "x\\nATTENDEE:mailto:otro@example.com\\nEND:VCALENDAR");
  });
});
