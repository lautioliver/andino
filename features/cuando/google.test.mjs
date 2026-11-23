// Tests del enlace a Google Calendar de «Avisame esta noche»: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GOOGLE_CALENDAR, urlDeGoogleCalendar } from "./google.ts";
import { armarIcs } from "./ics.ts";

/** Los parámetros como los lee Google: decodificados. */
const leer = (url) => new URL(url).searchParams;
/** El valor de una propiedad del .ics, con las líneas desplegadas y el texto sin escapar, como lo lee un calendario. */
const delIcs = (ics, nombre) =>
  ics
    .replace(/\r\n /g, "")
    .split("\r\n")
    .find((l) => l.startsWith(`${nombre}:`))
    .slice(nombre.length + 1)
    .replace(/\\([\\;,nN])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));

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

/** Datos que intentan salirse de su parámetro: cortar la consulta, abrir un fragmento, sumar otro destino. */
const HOSTILES = [
  "a&ctz=America/Lima&dates=19990101T000000Z/19990101T010000Z",
  "a#b",
  "a?b=c",
  "uno\r\nLocation: https://example.com/\ndos",
  "https://example.com/@",
  "//example.com/..%2F..",
  "100 % + 1 = ñandú; «Tilcara» \u{1F319}",
  "\u0000\u001b\u007f",
];

describe("el enlace a Google Calendar", () => {
  const url = urlDeGoogleCalendar(EVENTO);

  it("va siempre a calendar.google.com/calendar/render, por https", () => {
    assert.equal(GOOGLE_CALENDAR, "https://calendar.google.com/calendar/render");
    const u = new URL(url);
    assert.equal(u.origin, "https://calendar.google.com");
    assert.equal(u.pathname, "/calendar/render");
    assert.equal(u.username + u.password + u.hash, "");
    assert.ok(url.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE&"));
  });

  it("lleva la plantilla, el título, las fechas, la descripción y el lugar, y nada más: sin ctz", () => {
    assert.deepEqual([...leer(url).keys()], ["action", "text", "dates", "details", "location"]);
    assert.equal(leer(url).get("action"), "TEMPLATE");
    assert.equal(leer(url).get("ctz"), null);
  });

  it("escribe inicio/fin en UTC, como AAAAMMDDTHHMMSSZ", () => {
    assert.equal(leer(url).get("dates"), "20261129T002000Z/20261129T012000Z");
    // Con ceros a la izquierda y en UTC: las 21:04:05 del 1/1 en Argentina ya son el 2/1 allá.
    const temprano = urlDeGoogleCalendar({ ...EVENTO, inicio: new Date("2026-01-01T21:04:05-03:00").getTime(), fin: Date.UTC(2026, 0, 2, 3, 0, 0) });
    assert.equal(leer(temprano).get("dates"), "20260102T000405Z/20260102T030000Z");
    assert.match(leer(temprano).get("dates"), /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
  });

  it("el fin es el del evento, no una duración fija desde el inicio", () => {
    const largo = urlDeGoogleCalendar({ ...EVENTO, fin: Date.UTC(2026, 10, 29, 3, 50, 0) });
    assert.equal(leer(largo).get("dates"), "20261129T002000Z/20261129T035000Z");
  });

  it("dice lo mismo que el .ics: título, descripción, lugar, inicio y fin", () => {
    for (const evento of [EVENTO, { ...EVENTO, titulo: "Noche; con Luna, en Maimará", lugar: "Maimará, Jujuy", fin: Date.UTC(2026, 10, 29, 2, 5, 0) }]) {
      const ics = armarIcs(evento);
      const q = leer(urlDeGoogleCalendar(evento));
      assert.equal(q.get("text"), delIcs(ics, "SUMMARY"));
      assert.equal(q.get("details"), delIcs(ics, "DESCRIPTION"));
      assert.equal(q.get("location"), delIcs(ics, "LOCATION"));
      assert.equal(q.get("dates"), `${delIcs(ics, "DTSTART")}/${delIcs(ics, "DTEND")}`);
    }
    // La descripción llega entera, con el enlace a /cielo y sus propios & y %.
    assert.equal(leer(url).get("details"), EVENTO.descripcion);
    assert.ok(leer(url).get("details").endsWith("https://andino.test/cielo?placeId=purmamarca&fecha=2026-11-28&hora=21%3A20"));
  });

  it("codifica &, #, saltos de línea y tildes: la URL es ASCII de una sola línea y sus datos se leen iguales", () => {
    const raro = { ...EVENTO, titulo: "Luna & cerros #1: ¿Maimará o Humahuaca?", descripcion: "Uno\nDos & tres\r\n100 % + 1 = ñandú", lugar: "Maimará, Jujuy" };
    const armada = urlDeGoogleCalendar(raro);
    assert.match(armada, /^[\x21-\x7e]+$/, "quedó un espacio, un salto o un carácter fuera de ASCII");
    assert.ok(!armada.includes("#"), "un # sin codificar corta la consulta");
    assert.equal(armada.split("&").length, 5, "un & sin codificar suma parámetros");
    assert.ok(armada.includes("text=Luna+%26+cerros+%231%3A+%C2%BFMaimar%C3%A1+o+Humahuaca%3F&"));
    assert.ok(armada.includes("details=Uno%0ADos+%26+tres%0D%0A100+%25+%2B+1+%3D+%C3%B1and%C3%BA&"));
    assert.equal(leer(armada).get("text"), raro.titulo);
    assert.equal(leer(armada).get("details"), raro.descripcion);
    assert.equal(leer(armada).get("location"), raro.lugar);
  });

  it("ningún dato hostil cambia el destino ni suma parámetros", () => {
    for (const hostil of HOSTILES) {
      const armada = urlDeGoogleCalendar({ ...EVENTO, titulo: hostil, descripcion: hostil, lugar: hostil });
      const u = new URL(armada);
      assert.equal(u.origin, "https://calendar.google.com", hostil);
      assert.equal(u.pathname, "/calendar/render", hostil);
      assert.equal(u.hash, "", hostil);
      assert.match(armada, /^[\x21-\x7e]+$/, hostil);
      assert.deepEqual([...u.searchParams.keys()], ["action", "text", "dates", "details", "location"], hostil);
      assert.equal(u.searchParams.get("dates"), "20261129T002000Z/20261129T012000Z", hostil);
      for (const nombre of ["text", "details", "location"]) assert.equal(u.searchParams.get(nombre), hostil, hostil);
    }
  });
});
