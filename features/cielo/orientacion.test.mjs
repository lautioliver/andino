// Tests de «Apuntá» (orientación del teléfono → hacia dónde mira la cámara): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alphaAbsoluto, deltaAngular, suavizar, vistaDeLaCamara } from "./orientacion.ts";

const cerca = (real, esperado, tol = 0.5) => assert.ok(Math.abs(deltaAngular(real, esperado)) <= tol, `${real} vs ${esperado}`);

describe("vistaDeLaCamara", () => {
  // Casos armados a mano con la convención W3C: alpha crece hacia el oeste (antihorario visto desde arriba).
  const casos = [
    ["vertical, tope al norte", [0, 90, 0], { az: 0, alt: 0 }],
    ["vertical, girado 90° a la izquierda: mira al oeste", [90, 90, 0], { az: 270, alt: 0 }],
    ["vertical, girado 90° a la derecha: mira al este", [270, 90, 0], { az: 90, alt: 0 }],
    ["vertical, tope al sur", [180, 90, 0], { az: 180, alt: 0 }],
    ["inclinado hacia atrás 45°: mira al norte y arriba", [0, 135, 0], { az: 0, alt: 45 }],
    ["inclinado hacia adelante: mira al norte y abajo", [0, 60, 0], { az: 0, alt: -30 }],
  ];
  for (const [nombre, [a, b, g], esperado] of casos) {
    it(nombre, () => {
      const v = vistaDeLaCamara(a, b, g);
      cerca(v.az, esperado.az);
      assert.ok(Math.abs(v.alt - esperado.alt) < 0.5, `alt ${v.alt}`);
    });
  }

  it("apoyado boca arriba, la cámara mira al suelo", () => {
    assert.ok(vistaDeLaCamara(37, 0, 0).alt < -89.5);
  });

  it("de costado (gamma −90) la cámara queda horizontal", () => {
    // Tope al norte y apoyado sobre el lado izquierdo: gamma = −90 con beta = 0 deja la cámara al este.
    const v = vistaDeLaCamara(0, 0, -90);
    cerca(v.az, 90);
    assert.ok(Math.abs(v.alt) < 0.5);
  });

  it("acimut siempre en 0–360 y altura en −90–90", () => {
    for (let a = 0; a < 360; a += 37) for (let b = -180; b <= 180; b += 29) for (let g = -90; g <= 90; g += 23) {
      const v = vistaDeLaCamara(a, b, g);
      assert.ok(v.az >= 0 && v.az < 360 && v.alt >= -90 && v.alt <= 90, `${a},${b},${g}`);
    }
  });
});

describe("alphaAbsoluto", () => {
  it("iOS: usa webkitCompassHeading (horario) y lo pasa a alpha (antihorario)", () => {
    assert.equal(alphaAbsoluto({ alpha: 12, webkitCompassHeading: 90 }), 270);
    assert.equal(alphaAbsoluto({ alpha: 12, webkitCompassHeading: 0 }), 0);
    // De punta a punta: con el teléfono vertical, la cámara mira al rumbo de la brújula.
    cerca(vistaDeLaCamara(alphaAbsoluto({ alpha: 0, webkitCompassHeading: 120 }), 90, 0).az, 120);
  });
  it("Android: alpha absoluto tal cual", () => {
    assert.equal(alphaAbsoluto({ alpha: 45, absolute: true }), 45);
  });
  it("sin norte no inventa nada", () => {
    assert.equal(alphaAbsoluto({ alpha: 45, absolute: false }), null);
    assert.equal(alphaAbsoluto({ alpha: null, absolute: true }), null);
    assert.equal(alphaAbsoluto({ alpha: 45, webkitCompassHeading: Number.NaN }), null);
  });
});

describe("suavizar", () => {
  it("cruza el norte por el camino corto", () => {
    const v = suavizar({ az: 350, alt: 10 }, { az: 10, alt: 10 }, 0.5);
    cerca(v.az, 0);
  });
  it("acerca la altura en la fracción pedida", () => {
    assert.equal(suavizar({ az: 0, alt: 0 }, { az: 0, alt: 40 }, 0.25).alt, 10);
  });
  it("la primera lectura pasa sin filtrar", () => {
    assert.deepEqual(suavizar(null, { az: 5, alt: 6 }), { az: 5, alt: 6 });
  });
});
