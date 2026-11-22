// Tests del cielo desde la ubicación del teléfono: `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { distanciaKm, LEJOS_KM, paradaMasCercana, posicionValida, textoDistancia } from "./ubicacion.ts";

// Las paradas reales, leídas del archivo de datos (no se puede importar con el alias @/ desde node --test).
const fuente = readFileSync(new URL("../../data/places.ts", import.meta.url), "utf8");
const paradas = [...fuente.matchAll(/id: "(\w+)",\s*name: "([^"]+)",\s*latitude: (-?[\d.]+),\s*longitude: (-?[\d.]+)/g)].map((m) => ({
  id: m[1],
  name: m[2],
  latitude: Number(m[3]),
  longitude: Number(m[4]),
}));

describe("distanciaKm", () => {
  it("es cero en el mismo punto", () => {
    assert.equal(distanciaKm({ latitude: -23.7, longitude: -65.5 }, { latitude: -23.7, longitude: -65.5 }), 0);
  });
  it("un grado de latitud son unos 111 km", () => {
    const d = distanciaKm({ latitude: -23, longitude: -65 }, { latitude: -24, longitude: -65 });
    assert.ok(Math.abs(d - 111.2) < 0.5, `dio ${d}`);
  });
  it("Volcán a Tilcara está entre 35 y 45 km en línea recta", () => {
    const v = paradas.find((p) => p.id === "volcan");
    const t = paradas.find((p) => p.id === "tilcara");
    const d = distanciaKm(v, t);
    assert.ok(d > 35 && d < 45, `dio ${d}`);
  });
});

describe("paradaMasCercana", () => {
  it("lee todas las paradas del Tren Solar", () => {
    assert.ok(paradas.length >= 6, `leyó ${paradas.length}`);
  });
  it("en cada parada, la más cercana es ella misma a 0 km", () => {
    for (const p of paradas) {
      const r = paradaMasCercana(p, paradas);
      assert.equal(r.parada.id, p.id);
      assert.equal(r.km, 0);
    }
  });
  it("desde la plaza de Purmamarca elige Purmamarca", () => {
    const r = paradaMasCercana({ latitude: -23.7445, longitude: -65.4985 }, paradas);
    assert.equal(r.parada.id, "purmamarca");
    assert.ok(r.km < LEJOS_KM);
  });
  it("desde San Salvador de Jujuy queda lejos del recorrido", () => {
    const r = paradaMasCercana({ latitude: -24.1858, longitude: -65.2995 }, paradas);
    assert.equal(r.parada.id, "volcan");
    assert.ok(r.km > LEJOS_KM, `dio ${r.km}`);
  });
  it("sin paradas devuelve null", () => {
    assert.equal(paradaMasCercana({ latitude: 0, longitude: 0 }, []), null);
  });
});

describe("posicionValida", () => {
  it("acepta coordenadas reales", () => {
    assert.ok(posicionValida({ latitude: -23.7, longitude: -65.5 }));
  });
  it("rechaza vacíos, NaN y fuera de rango", () => {
    for (const p of [null, undefined, {}, { latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: "1", longitude: 2 }]) {
      assert.equal(posicionValida(p), false, JSON.stringify(p));
    }
  });
});

describe("textoDistancia", () => {
  it("menos de un km en metros, redondeado a 100 y nunca 0", () => {
    assert.equal(textoDistancia(0), "100 m");
    assert.equal(textoDistancia(0.44), "400 m");
  });
  it("desde un km, en km enteros", () => {
    assert.equal(textoDistancia(1.4), "1 km");
    assert.equal(textoDistancia(12.6), "13 km");
  });
});
