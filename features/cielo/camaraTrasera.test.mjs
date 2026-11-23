// Tests de «Cámara» (campo visual del video detrás del cielo y motivos de fallo): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { campoVisible, DIAGONAL_SUPUESTA_DEG, esCamaraDeAtras, falloDeCamara } from "./camaraTrasera.ts";

const RAD = Math.PI / 180;
const cerca = (real, esperado, tol = 0.05) => assert.ok(Math.abs(real - esperado) <= tol, `${real} vs ${esperado}`);
/** Campo de un lado que ocupa la fracción `lado / diagonal` de un cuadro con esa diagonal. */
const campoDelLado = (fraccion, diagonalDeg) => (2 * Math.atan(fraccion * Math.tan((diagonalDeg * RAD) / 2))) / RAD;

describe("campoVisible", () => {
  it("video 4:3 apaisado en un área igual: el lado largo es 0,8 de la diagonal", () => {
    cerca(campoVisible({ ancho: 640, alto: 480 }, { ancho: 640, alto: 480 }, 80), campoDelLado(0.8, 80));
  });

  it("video 4:3 vertical (teléfono parado): el ancho es el lado corto, 0,6 de la diagonal", () => {
    cerca(campoVisible({ ancho: 480, alto: 640 }, { ancho: 480, alto: 640 }, 80), campoDelLado(0.6, 80));
  });

  it("no depende del tamaño en pantalla, solo de las proporciones", () => {
    const chico = campoVisible({ ancho: 480, alto: 640 }, { ancho: 390, alto: 520 });
    const grande = campoVisible({ ancho: 1080, alto: 1440 }, { ancho: 780, alto: 1040 });
    cerca(chico, grande, 1e-9);
  });

  it("área más ancha que el video: se recorta arriba y abajo y se ve todo el ancho", () => {
    const completo = campoVisible({ ancho: 640, alto: 480 }, { ancho: 640, alto: 480 });
    cerca(campoVisible({ ancho: 640, alto: 480 }, { ancho: 1280, alto: 400 }), completo, 1e-9);
  });

  it("área más angosta que el video: se recortan los costados y el campo se achica", () => {
    // El video llena el alto (escala 1) y se ven 240 de sus 640 píxeles de ancho.
    const focal = 400 / Math.tan(40 * RAD);
    cerca(campoVisible({ ancho: 640, alto: 480 }, { ancho: 240, alto: 480 }, 80), (2 * Math.atan(120 / focal)) / RAD, 1e-9);
  });

  it("con una diagonal más abierta, el campo visible crece", () => {
    const video = { ancho: 480, alto: 640 };
    assert.ok(campoVisible(video, video, 100) > campoVisible(video, video, 80));
  });

  it("sin diagonal explícita usa la supuesta", () => {
    const video = { ancho: 480, alto: 640 };
    assert.equal(campoVisible(video, video), campoVisible(video, video, DIAGONAL_SUPUESTA_DEG));
  });

  it("sin medidas no inventa un campo", () => {
    assert.equal(campoVisible({ ancho: 0, alto: 0 }, { ancho: 390, alto: 520 }), null);
    assert.equal(campoVisible({ ancho: 480, alto: 640 }, { ancho: 0, alto: 520 }), null);
    assert.equal(campoVisible({ ancho: Number.NaN, alto: 640 }, { ancho: 390, alto: 520 }), null);
  });
});

describe("falloDeCamara", () => {
  it("permiso negado o contexto inseguro: denegada", () => {
    assert.equal(falloDeCamara({ name: "NotAllowedError" }), "denegada");
    assert.equal(falloDeCamara({ name: "SecurityError" }), "denegada");
  });
  it("sin cámara, ocupada o cualquier otro error: sin-camara", () => {
    assert.equal(falloDeCamara({ name: "NotFoundError" }), "sin-camara");
    assert.equal(falloDeCamara({ name: "NotReadableError" }), "sin-camara");
    assert.equal(falloDeCamara(new Error("otra cosa")), "sin-camara");
    assert.equal(falloDeCamara(null), "sin-camara");
    assert.equal(falloDeCamara("NotAllowedError"), "sin-camara");
  });
});

describe("esCamaraDeAtras", () => {
  it("la del frente no sirve: mira para el otro lado", () => {
    assert.equal(esCamaraDeAtras("user"), false);
  });
  it("la de atrás, o una que no informa el lado, sí", () => {
    assert.equal(esCamaraDeAtras("environment"), true);
    assert.equal(esCamaraDeAtras(undefined), true);
  });
});
