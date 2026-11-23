// Tests del cielo inmersivo: `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  aHorizonte,
  camara,
  desplazarISO,
  enCamara,
  matrizHorizonte,
  oscuridad,
  proyectar,
  recortarPoligono,
} from "./firmamento.ts";
import { computeSky } from "./motor.ts";

const PURMAMARCA = { latitude: -23.744, longitude: -65.499 };
const DEMO = "2026-11-22T22:00:00-03:00";
const deltaAz = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe("aHorizonte (catálogo J2000 → horizonte)", () => {
  const m = matrizHorizonte(PURMAMARCA, DEMO);
  const motor = Object.fromEntries(computeSky(PURMAMARCA, DEMO).map((o) => [o.id, o]));

  // El motor ya está verificado contra JPL Horizons y un cálculo independiente.
  // Diferencia esperada < 0,05°: aberración anual (≤ 0,006°) y redondeo.
  it("Sirio coincide con el motor", () => {
    const s = aHorizonte(m, 101.287155, -16.716116);
    assert.ok(Math.abs(s.alt - motor.sirio.altitudeDeg) < 0.05, JSON.stringify(s));
    assert.ok(deltaAz(s.az, motor.sirio.azimuthDeg) < 0.05, JSON.stringify(s));
  });

  it("Acrux coincide con el motor (bajo el horizonte, sin refracción)", () => {
    const a = aHorizonte(m, 186.649665, -63.099093);
    assert.ok(Math.abs(a.alt - motor.acrux.altitudeDeg) < 0.05, JSON.stringify(a));
    assert.ok(deltaAz(a.az, motor.acrux.azimuthDeg) < 0.05, JSON.stringify(a));
  });

  it("el polo sur celeste queda al sur, a la altura de la latitud", () => {
    const p = aHorizonte(m, 0, -90);
    assert.ok(Math.abs(p.alt - 23.744) < 0.5, JSON.stringify(p));
    assert.ok(deltaAz(p.az, 180) < 0.5, JSON.stringify(p));
  });
});

describe("proyección a pantalla", () => {
  const c = camara({ az: 180, alt: 20, fov: 90 }, 400, 600);

  it("el centro de la vista cae en el centro de la pantalla", () => {
    const p = proyectar(c, 20, 180);
    assert.ok(Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 300) < 1e-6);
  });

  it("mirando al sur, el este queda a la izquierda y el oeste a la derecha", () => {
    assert.ok(proyectar(c, 20, 150).x < 200);
    assert.ok(proyectar(c, 20, 210).x > 200);
  });

  it("más alto en el cielo es más arriba en la pantalla", () => {
    assert.ok(proyectar(c, 40, 180).y < proyectar(c, 0, 180).y);
  });

  it("el borde del campo visual cae en el borde de la pantalla", () => {
    const c0 = camara({ az: 0, alt: 0, fov: 90 }, 400, 600);
    assert.ok(Math.abs(proyectar(c0, 0, 45).x - 400) < 1e-6);
  });

  it("lo que está a la espalda no se proyecta", () => {
    assert.equal(proyectar(c, 20, 0), null);
  });

  it("recorta polígonos que cruzan detrás del observador", () => {
    const pts = [
      [0, 0, 1],
      [1, 0, -1],
      [0, 1, 1],
    ];
    const r = recortarPoligono(pts, -0.2);
    assert.ok(r.every((p) => p[2] >= -0.2 - 1e-9));
    assert.equal(r.length, 4);
    assert.ok(enCamara(c, 20, 180)[2] > 0.999);
  });
});

describe("cámara ladeada (giro)", () => {
  const vista = { az: 180, alt: 20, fov: 90 };
  const derecha = camara(vista, 400, 600);
  // Tope del teléfono volcado 20° a la izquierda: en la pantalla, el mundo se ve girado 20° a la derecha.
  const ladeada = camara({ ...vista, giro: 20 }, 400, 600);

  it("sin giro, o con una vuelta entera, la cámara es la de siempre", () => {
    assert.deepEqual(camara({ ...vista, giro: 0 }, 400, 600), derecha);
    // El giro va en grados: 360 es una vuelta completa.
    const vuelta = proyectar(camara({ ...vista, giro: 360 }, 400, 600), 40, 150);
    const sinGiro = proyectar(derecha, 40, 150);
    assert.ok(Math.abs(vuelta.x - sinGiro.x) < 1e-6 && Math.abs(vuelta.y - sinGiro.y) < 1e-6, JSON.stringify(vuelta));
  });

  it("el centro de la vista no se mueve", () => {
    const p = proyectar(ladeada, 20, 180);
    assert.ok(Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 300) < 1e-6);
  });

  it("lo que está más alto en el cielo se corre hacia la derecha de la pantalla", () => {
    const p = proyectar(ladeada, 40, 180);
    assert.ok(p.x > 200 && p.y < 300, JSON.stringify(p));
  });

  it("el horizonte baja hacia la derecha", () => {
    // Mirando al sur, el oeste (acimut 210) queda a la derecha.
    assert.ok(proyectar(ladeada, 0, 210).y > proyectar(ladeada, 0, 150).y);
    assert.ok(Math.abs(proyectar(derecha, 0, 210).y - proyectar(derecha, 0, 150).y) < 1e-6);
  });

  it("es un giro alrededor del centro: la distancia al centro no cambia y el ángulo es el pedido", () => {
    const a = proyectar(derecha, 40, 180);
    const b = proyectar(ladeada, 40, 180);
    assert.ok(Math.abs(Math.hypot(a.x - 200, a.y - 300) - Math.hypot(b.x - 200, b.y - 300)) < 1e-6);
    // «a» queda justo arriba del centro; «b», 20° hacia la derecha.
    const angulo = (Math.atan2(b.x - 200, 300 - b.y) * 180) / Math.PI;
    assert.ok(Math.abs(angulo - 20) < 1e-6, `${angulo}`);
  });

  it("acostado (giro 90), lo que estaba arriba queda a la derecha", () => {
    const p = proyectar(camara({ ...vista, giro: 90 }, 400, 600), 40, 180);
    assert.ok(p.x > 200 && Math.abs(p.y - 300) < 1e-6, JSON.stringify(p));
  });
});

describe("tiempo y luz", () => {
  it("desplaza minutos manteniendo la zona de Argentina", () => {
    assert.equal(desplazarISO("2026-11-22T22:00:00-03:00", 150), "2026-11-23T00:30:00-03:00");
    assert.equal(desplazarISO("2026-11-23T01:00:00Z", -60), "2026-11-22T21:00:00-03:00");
  });

  it("oscuridad: de día 0, de noche cerrada 1", () => {
    assert.equal(oscuridad(10), 0);
    assert.equal(oscuridad(-20), 1);
    assert.ok(oscuridad(-8) > 0 && oscuridad(-8) < 1);
  });
});

describe("catálogo", () => {
  const cat = JSON.parse(readFileSync(new URL("../../data/cielo/catalogo.json", import.meta.url), "utf8"));

  it("tiene estrellas, 88 constelaciones (Serpiente en dos) y Vía Láctea", () => {
    assert.ok(cat.estrellas.length > 1500);
    assert.equal(cat.constelaciones.length, 89);
    assert.ok(cat.viaLactea.length >= 3);
    assert.match(cat.fuente, /d3-celestial/);
  });

  it("Sirio es la estrella más brillante y está en su lugar", () => {
    const [ar, dec, mag] = cat.estrellas[0];
    assert.ok(Math.abs(ar - 101.29) < 0.05 && Math.abs(dec + 16.72) < 0.05 && mag < -1.4);
  });

  it("la Cruz del Sur se llama así", () => {
    assert.equal(cat.constelaciones.find((c) => c.id === "Cru").nombre, "Cruz del Sur");
  });
});
