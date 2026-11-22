// Tests de la hoja inferior de Cielo y del encuadre del cielo que queda a la vista: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { altitudCamara, gradosTapados, limitarAltitud, limitarHoja, soltarHoja } from "./hoja.ts";

describe("soltarHoja (a qué posición encastra al soltar)", () => {
  const recorrido = 300;
  it("soltada cerca de arriba, sin impulso: alta", () => {
    assert.equal(soltarHoja({ desplazamiento: 100, recorrido, velocidad: 0 }), "alta");
  });
  it("soltada cerca de abajo, sin impulso: baja", () => {
    assert.equal(soltarHoja({ desplazamiento: 200, recorrido, velocidad: 0 }), "baja");
  });
  it("un tirón hacia arriba la sube aunque esté abajo", () => {
    assert.equal(soltarHoja({ desplazamiento: 260, recorrido, velocidad: -0.8 }), "alta");
  });
  it("un tirón hacia abajo la baja aunque esté arriba", () => {
    assert.equal(soltarHoja({ desplazamiento: 20, recorrido, velocidad: 0.8 }), "baja");
  });
  it("sin recorrido (no hay detalle que mostrar) queda baja", () => {
    assert.equal(soltarHoja({ desplazamiento: 0, recorrido: 0, velocidad: -1 }), "baja");
  });
});

describe("limitarHoja", () => {
  it("no pasa de los topes", () => {
    assert.equal(limitarHoja(-50, 300), 0);
    assert.equal(limitarHoja(400, 300), 300);
    assert.equal(limitarHoja(120, 300), 120);
  });
});

describe("encuadre con la hoja tapando la parte de abajo", () => {
  it("convierte los píxeles tapados en grados del centro de la vista", () => {
    // 390 px de ancho con 80° de campo: ~0,205°/px. La mitad de 400 px tapados = 200 px ≈ 41°.
    assert.ok(Math.abs(gradosTapados(400, 390, 80) - 41.03) < 0.1);
    assert.equal(gradosTapados(0, 390, 80), 0);
  });
  it("sin hoja, la cámara mira al centro visible", () => {
    assert.equal(altitudCamara(40, 0), 40);
  });
  it("con hoja, la cámara baja lo que tapa la hoja: el centro visible no se mueve", () => {
    assert.equal(altitudCamara(40, 20), 20);
  });
});

describe("limitarAltitud (centro del cielo visible)", () => {
  it("entre 8° (se ve el horizonte) y 80°", () => {
    assert.equal(limitarAltitud(5), 8);
    assert.equal(limitarAltitud(89), 80);
    assert.equal(limitarAltitud(45), 45);
  });
});
