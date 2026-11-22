// Tests del motor de Cielo Andino: `npm test`.
// En JavaScript para correr con el `node --test` nativo (Node ≥ 23 ejecuta el .ts del motor
// sin compilar); así no sumamos un runner ni tocamos tsconfig.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSky, parseDatetimeISO, SKY_CATALOG } from "./motor.ts";

const PURMAMARCA = { latitude: -23.744, longitude: -65.499 };
const DEMO = "2026-11-22T22:00:00-03:00"; // = 2026-11-23T01:00:00Z

const porId = (objetos) => Object.fromEntries(objetos.map((o) => [o.id, o]));

// Diferencia angular de acimut, contemplando el salto 359° → 0°.
const deltaAz = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe("computeSky contra JPL Horizons", () => {
  // Referencia independiente: JPL Horizons (DE441), consultado el 22/11/2026.
  // Observador geodésico -65.499 E, -23.744 N, 0 km; 2026-11-23 01:00 UT;
  // QUANTITIES=4 (acimut/elevación aparentes), APPARENT=REFRACTED, salvo Júpiter: bajo el
  // horizonte la refracción no tiene sentido físico (Horizons igual suma 0,65°), así que se
  // compara con APPARENT=AIRLESS, que es lo que devuelve el motor por debajo de -1°.
  const HORIZONS = {
    luna: { az: 30.076029, alt: 40.791057 },
    saturno: { az: 352.958828, alt: 65.243391 },
    jupiter: { az: 96.514022, alt: -48.464072 },
  };
  const cielo = porId(computeSky(PURMAMARCA, DEMO));

  for (const id of ["luna", "saturno"]) {
    it(`${id}: altitud y acimut dentro de 0,05°`, () => {
      assert.ok(Math.abs(cielo[id].altitudeDeg - HORIZONS[id].alt) < 0.05, JSON.stringify(cielo[id]));
      assert.ok(deltaAz(cielo[id].azimuthDeg, HORIZONS[id].az) < 0.05, JSON.stringify(cielo[id]));
      assert.equal(cielo[id].isAboveHorizon, true);
    });
  }

  it("júpiter: bajo el horizonte, sin refracción, dentro de 0,05°", () => {
    assert.equal(cielo.jupiter.isAboveHorizon, false);
    assert.ok(Math.abs(cielo.jupiter.altitudeDeg - HORIZONS.jupiter.alt) < 0.05, JSON.stringify(cielo.jupiter));
    assert.ok(deltaAz(cielo.jupiter.azimuthDeg, HORIZONS.jupiter.az) < 0.05);
  });
});

describe("computeSky contra un cálculo propio para estrellas", () => {
  // Horizons no da estrellas: comparamos con un cálculo independiente y más simple
  // (precesión de Meeus cap. 21 aproximada, tiempo sidéreo IAU 1982, refracción de Bennett).
  // Error esperado del método simple: < 0,1°.
  const rad = Math.PI / 180;
  function estrellaSimple(raHoras, decDeg, lugar, fecha) {
    const jd = fecha.getTime() / 86400000 + 2440587.5;
    const anios = (jd - 2451545.0) / 365.25;
    const ra0 = raHoras * 15;
    const ra = ra0 + (anios * (3.075 + 1.336 * Math.sin(ra0 * rad) * Math.tan(decDeg * rad)) * 15) / 3600;
    const dec = decDeg + (anios * 20.04 * Math.cos(ra0 * rad)) / 3600;
    const d = jd - 2451545.0;
    const gmst = (280.46061837 + 360.98564736629 * d) % 360;
    const ha = (gmst + lugar.longitude - ra) * rad;
    const lat = lugar.latitude * rad;
    const sinAlt = Math.sin(lat) * Math.sin(dec * rad) + Math.cos(lat) * Math.cos(dec * rad) * Math.cos(ha);
    const alt = Math.asin(sinAlt) / rad;
    const az =
      (Math.atan2(-Math.sin(ha), Math.tan(dec * rad) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha)) / rad + 360) % 360;
    const refraccion = alt > -1 ? 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * rad) / 60 : 0;
    return { alt: alt + refraccion, az };
  }

  const cielo = porId(computeSky(PURMAMARCA, DEMO));
  const fecha = parseDatetimeISO(DEMO);
  const casos = { sirio: [6.752477, -16.716116], acrux: [12.443311, -63.099093] };

  for (const [id, [ra, dec]] of Object.entries(casos)) {
    it(`${id}: altitud y acimut dentro de 0,1°`, () => {
      const ref = estrellaSimple(ra, dec, PURMAMARCA, fecha);
      assert.ok(Math.abs(cielo[id].altitudeDeg - ref.alt) < 0.1, `${JSON.stringify(cielo[id])} vs ${JSON.stringify(ref)}`);
      assert.ok(deltaAz(cielo[id].azimuthDeg, ref.az) < 0.1, `${JSON.stringify(cielo[id])} vs ${JSON.stringify(ref)}`);
    });
  }
});

describe("computeSky: contrato y comportamiento", () => {
  it("devuelve un SkyObject por cada objeto del catálogo, en orden", () => {
    const objetos = computeSky(PURMAMARCA, DEMO);
    assert.deepEqual(
      objetos.map((o) => o.id),
      SKY_CATALOG.map((o) => o.id),
    );
    for (const o of objetos) {
      assert.deepEqual(Object.keys(o).sort(), ["altitudeDeg", "azimuthDeg", "id", "isAboveHorizon", "name"]);
      assert.ok(o.azimuthDeg >= 0 && o.azimuthDeg < 360);
      assert.ok(o.altitudeDeg >= -90 && o.altitudeDeg <= 90);
      assert.equal(o.isAboveHorizon, o.altitudeDeg > 0);
    }
  });

  it("el mismo instante en otra zona horaria da el mismo cielo", () => {
    assert.deepEqual(computeSky(PURMAMARCA, DEMO), computeSky(PURMAMARCA, "2026-11-23T01:00:00Z"));
  });

  it("cambiar la hora cambia las posiciones", () => {
    const noche = porId(computeSky(PURMAMARCA, DEMO));
    const madrugada = porId(computeSky(PURMAMARCA, "2026-11-23T03:00:00-03:00"));
    assert.notEqual(noche.saturno.altitudeDeg, madrugada.saturno.altitudeDeg);
  });

  it("cambiar el lugar cambia las posiciones", () => {
    const purmamarca = porId(computeSky(PURMAMARCA, DEMO));
    const humahuaca = porId(computeSky({ latitude: -23.205, longitude: -65.349 }, DEMO));
    assert.notEqual(purmamarca.sirio.altitudeDeg, humahuaca.sirio.altitudeDeg);
  });

  it("rechaza fechas sin zona horaria o inválidas", () => {
    assert.throws(() => computeSky(PURMAMARCA, "2026-11-22T22:00:00"), RangeError);
    assert.throws(() => computeSky(PURMAMARCA, "2026-11-22"), RangeError);
    assert.throws(() => computeSky(PURMAMARCA, "2026-13-45T22:00:00Z"), RangeError);
  });
});

describe("fichas educativas", () => {
  it("cada objeto del catálogo tiene ficha con al menos una fuente", async () => {
    const { SKY_OBJECT_INFO } = await import("../../data/astronomy.ts");
    for (const { id } of SKY_CATALOG) {
      assert.ok(SKY_OBJECT_INFO[id], `falta la ficha de ${id}`);
      assert.ok(SKY_OBJECT_INFO[id].sources.length > 0, `${id} sin fuentes`);
    }
  });
});
