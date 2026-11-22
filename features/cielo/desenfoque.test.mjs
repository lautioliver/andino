// Tests del desenfoque de la Vía Láctea: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { desenfocarAlfa } from "./desenfoque.ts";

/** Imagen RGBA de `ancho`×1 con alfa 255 en la mitad izquierda y 0 en la derecha. */
function escalon(ancho) {
  const d = new Uint8ClampedArray(ancho * 4);
  for (let x = 0; x < ancho / 2; x++) d[x * 4 + 3] = 255;
  return d;
}
const alfas = (d) => Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3]);

describe("desenfocarAlfa", () => {
  it("un borde duro pasa a ser una transición gradual", () => {
    const a = alfas(desenfocarAlfa(escalon(20), 20, 1, 2, [214, 222, 240]));
    // Lejos del borde no cambia; en el borde aparecen valores intermedios que bajan sin saltos.
    assert.equal(a[0], 255);
    assert.equal(a[19], 0);
    const intermedios = a.filter((v) => v > 0 && v < 255);
    assert.ok(intermedios.length >= 4, JSON.stringify(a));
    for (let i = 1; i < a.length; i++) assert.ok(a[i] <= a[i - 1], JSON.stringify(a));
    for (let i = 1; i < a.length; i++) assert.ok(a[i - 1] - a[i] < 128, `salto en ${i}: ${JSON.stringify(a)}`);
  });

  it("conserva el total de luz (no oscurece ni aclara)", () => {
    const original = alfas(escalon(20)).reduce((s, v) => s + v, 0);
    const borroso = alfas(desenfocarAlfa(escalon(20), 20, 1, 2, [0, 0, 0])).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(original - borroso) / original < 0.02, `${original} vs ${borroso}`);
  });

  it("pinta todo del color de la Vía Láctea: el borde no se ensucia de negro", () => {
    const d = desenfocarAlfa(escalon(20), 20, 1, 2, [214, 222, 240]);
    for (let i = 0; i < 20; i++) assert.deepEqual([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], [214, 222, 240]);
  });

  it("desenfoca también en vertical", () => {
    const d = new Uint8ClampedArray(1 * 20 * 4);
    for (let y = 0; y < 10; y++) d[y * 4 + 3] = 255;
    const a = alfas(desenfocarAlfa(d, 1, 20, 2, [0, 0, 0]));
    assert.ok(a.some((v) => v > 0 && v < 255), JSON.stringify(a));
  });
});
