// Tests de los pasos de satélites (lógica pura): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as sat from "satellite.js";
import { ALTURA_MIN_DEG, calcularPasos, leerTle, nocheCalculable, PASO_MS } from "./pasos.ts";

const PURMAMARCA = { latitude: -23.7333, longitude: -65.4833 };
const mediodia = (fecha) => `${fecha}T12:00:00-03:00`;

// TLE real de la Estación Espacial, bajado de CelesTrak (CATNR=25544) el 22/11/2026, tal cual llega:
// con espacios de relleno y saltos de línea \r\n.
const RESPUESTA_CELESTRAK =
  "ISS (ZARYA)             \r\n" +
  "1 25544U 98067A   26326.55861648  .00009004  00000+0  16808-3 0  9990\r\n" +
  "2 25544  51.6321 236.3579 0007404  53.9088 306.2585 15.49552037596306\r\n";
const [NOMBRE, L1, L2] = RESPUESTA_CELESTRAK.split("\r\n").map((l) => l.trim());
const ESTACION = leerTle([NOMBRE, L1, L2].join("\n"));

/** Altura sobre el horizonte e iluminación en un instante, sin pasar por calcularPasos. */
function mirar(tle, lugar, ms) {
  const d = new Date(ms);
  const pos = sat.propagate(tle.rec, d).position;
  const obs = { latitude: sat.degreesToRadians(lugar.latitude), longitude: sat.degreesToRadians(lugar.longitude), height: 2 };
  const la = sat.ecfToLookAngles(obs, sat.eciToEcf(pos, sat.gstime(d)));
  return { alturaDeg: sat.radiansToDegrees(la.elevation), iluminado: sat.shadowFraction(sat.sunPos(sat.jday(d)).rsun, pos) < 0.5 };
}
const seVe = (tle, lugar, ms) => {
  const m = mirar(tle, lugar, ms);
  return m.alturaDeg >= ALTURA_MIN_DEG && m.iluminado;
};

describe("la Estación Espacial con su TLE real", () => {
  it("leerTle reconoce el objeto 25544", () => {
    assert.equal(ESTACION.length, 1);
    assert.equal(ESTACION[0].nombre, "ISS (ZARYA)");
    assert.equal(Number(ESTACION[0].rec.satnum), 25544);
  });

  it("la noche del 22/11/2026 no tiene pasos visibles desde Purmamarca", () => {
    const n = calcularPasos(ESTACION, PURMAMARCA, mediodia("2026-11-22"), 6, ALTURA_MIN_DEG);
    assert.equal(n.totalPasos, 0);
    assert.deepEqual(n.destacados, []);
  });

  it("un paso alto: empieza, llega al máximo y termina en orden, dentro de la ventana", () => {
    const n = calcularPasos(ESTACION, PURMAMARCA, mediodia("2026-12-05"), 6, ALTURA_MIN_DEG);
    assert.equal(n.destacados.length, 1);
    const [p] = n.destacados;
    const [inicio, maximo, termina] = [p.inicio, p.maximo, p.termina].map((x) => Date.parse(x));
    assert.ok(Date.parse(n.desde) <= inicio && inicio < maximo && maximo < termina && termina <= Date.parse(n.hasta), JSON.stringify(p));
    assert.equal(p.satelites, 1);
    assert.ok(p.alturaMaxDeg > 45, `altura ${p.alturaMaxDeg}`);
    // El máximo es de verdad el punto más alto: coincide con la altura calculada aparte en ese instante.
    assert.ok(Math.abs(mirar(ESTACION[0], PURMAMARCA, maximo).alturaDeg - p.alturaMaxDeg) <= 0.5);
  });

  it("«termina» es la última muestra en que se ve: una muestra después ya no", () => {
    for (const fecha of ["2026-12-04", "2026-12-05", "2026-12-06"]) {
      for (const p of calcularPasos(ESTACION, PURMAMARCA, mediodia(fecha), 6, ALTURA_MIN_DEG).destacados) {
        const termina = Date.parse(p.termina);
        assert.ok(seVe(ESTACION[0], PURMAMARCA, termina), `${fecha}: en ${p.termina} todavía se ve`);
        assert.ok(!seVe(ESTACION[0], PURMAMARCA, termina + PASO_MS), `${fecha}: 30 s después de ${p.termina} ya no`);
      }
    }
  });

  it("no lista lo que pasa por la sombra de la Tierra, aunque esté sobre el horizonte", () => {
    const n = calcularPasos(ESTACION, PURMAMARCA, mediodia("2026-10-28"), 6, ALTURA_MIN_DEG);
    const dentroDeUnPaso = (ms) => n.destacados.some((p) => Date.parse(p.inicio) <= ms && ms <= Date.parse(p.termina));
    let aOscuras = 0;
    for (let ms = Date.parse(n.desde); ms <= Date.parse(n.hasta); ms += PASO_MS) {
      const m = mirar(ESTACION[0], PURMAMARCA, ms);
      if (m.alturaDeg < ALTURA_MIN_DEG) continue;
      if (!m.iluminado) aOscuras++;
      assert.equal(dentroDeUnPaso(ms), m.iluminado, `${new Date(ms).toISOString()}: altura ${m.alturaDeg.toFixed(0)}°, iluminado ${m.iluminado}`);
    }
    assert.ok(aOscuras > 0, "esa noche tiene que haber un tramo sobre 10° en la sombra para que el test pruebe algo");
  });

  it("no la marca como «lanzamiento reciente»: con un solo objeto no hay recientes", () => {
    const pasos = ["2026-12-04", "2026-12-05", "2026-12-06"].flatMap((f) => calcularPasos(ESTACION, PURMAMARCA, mediodia(f), 6, ALTURA_MIN_DEG).destacados);
    assert.ok(pasos.length >= 3);
    assert.ok(pasos.every((p) => p.recienLanzado === false), JSON.stringify(pasos.map((p) => p.recienLanzado)));
  });

  it("los pasos bajos (10° a 20°) solo se listan si se pide la altura mínima", () => {
    const altos = calcularPasos(ESTACION, PURMAMARCA, mediodia("2026-10-28"));
    assert.equal(altos.totalPasos, 2);
    assert.deepEqual(altos.destacados, []);
    const todos = calcularPasos(ESTACION, PURMAMARCA, mediodia("2026-10-28"), 6, ALTURA_MIN_DEG);
    assert.equal(todos.destacados.length, 2);
    assert.ok(todos.destacados.every((p) => p.alturaMaxDeg >= ALTURA_MIN_DEG && p.alturaMaxDeg < 20), JSON.stringify(todos.destacados));
  });
});

describe("lanzamientos recientes en un set con muchos lanzamientos", () => {
  // Cinco copias de la misma órbita con distinto designador de lanzamiento (columnas 10 a 14 de la
  // línea 1): datos de prueba, no satélites reales.
  const FLOTA = leerTle(
    ["20001", "21001", "22001", "23001", "24001"].map((lanz) => [`PRUEBA-${lanz}`, L1.slice(0, 9) + lanz + L1.slice(14), L2].join("\n")).join("\n"),
  );

  it("solo los tres lanzamientos más nuevos quedan como recientes", () => {
    assert.deepEqual(FLOTA.map((t) => t.lanzamiento), ["20001", "21001", "22001", "23001", "24001"]);
    const n = calcularPasos(FLOTA, PURMAMARCA, mediodia("2026-12-05"), 10);
    assert.equal(n.destacados.length, 5);
    const recientes = n.destacados.filter((p) => p.recienLanzado).map((p) => p.nombre).sort();
    assert.deepEqual(recientes, ["PRUEBA-22001", "PRUEBA-23001", "PRUEBA-24001"]);
  });
});

describe("qué noches se pueden calcular", () => {
  const AHORA = Date.parse("2026-11-22T20:50:00-03:00");

  // Se mide desde el mediodía de la fecha: a las 20:50 del 22, el mediodía del 19 ya quedó a más de 3 días.
  it("acepta esta noche y las que están a 3 días o menos", () => {
    for (const f of ["2026-11-20", "2026-11-22", "2026-11-25"]) assert.equal(nocheCalculable(f, AHORA), true, f);
  });

  it("la noche en curso sigue valiendo de madrugada, antes de las 6", () => {
    assert.equal(nocheCalculable("2026-11-22", Date.parse("2026-11-23T05:59:00-03:00")), true);
  });

  it("los 3 días se cuentan desde el mediodía de Jujuy de esa fecha", () => {
    assert.equal(nocheCalculable("2026-11-19", Date.parse("2026-11-22T12:00:00-03:00")), true);
    assert.equal(nocheCalculable("2026-11-19", Date.parse("2026-11-22T12:00:01-03:00")), false);
    assert.equal(nocheCalculable("2026-11-25", Date.parse("2026-11-22T12:00:00-03:00")), true);
    assert.equal(nocheCalculable("2026-11-25", Date.parse("2026-11-22T11:59:59-03:00")), false);
  });

  it("rechaza noches más lejanas", () => {
    for (const f of ["2026-11-19", "2026-11-26", "2025-11-22", "2027-11-22"]) assert.equal(nocheCalculable(f, AHORA), false, f);
  });

  it("rechaza días que no existen aunque estén cerca", () => {
    // 2026-11-31 se leería como 1 de diciembre, que sí está cerca del 30 de noviembre.
    const fin = Date.parse("2026-11-30T20:00:00-03:00");
    assert.equal(nocheCalculable("2026-12-01", fin), true);
    assert.equal(nocheCalculable("2026-11-31", fin), false);
    assert.equal(nocheCalculable("2026-02-30", Date.parse("2026-03-01T12:00:00-03:00")), false);
  });

  it("rechaza lo que no es una fecha YYYY-MM-DD", () => {
    const hostiles = [null, undefined, "", "hoy", "2026-11-22T12:00", "2026-11-22 ", " 2026-11-22", "2026-13-01", "2026-1-5", "22/11/2026", "2026-11-22\n", "2".repeat(100_000), "2026-11-22'; DROP TABLE"];
    for (const f of hostiles) assert.equal(nocheCalculable(f, AHORA), false, String(f).slice(0, 30));
  });
});
