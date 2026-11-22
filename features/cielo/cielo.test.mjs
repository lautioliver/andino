// Tests de la lógica pura de la pantalla Cielo: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDatetimeISO,
  describirAltura,
  fechaArgentina,
  luzDelCielo,
  proyectarEnDomo,
  rumbo,
} from "./cielo.ts";
import { sunAltitudeDeg } from "./motor.ts";

const cerca = (a, b) => Math.abs(a - b) < 1e-9;

describe("fechas", () => {
  it("arma ISO con la zona de Argentina", () => {
    assert.equal(buildDatetimeISO("2026-11-22", "22:00"), "2026-11-22T22:00:00-03:00");
  });

  it("la fecha de hoy es la de Argentina, no la UTC", () => {
    // 01:30 UTC del 23 = 22:30 del 22 en Argentina.
    assert.equal(fechaArgentina(new Date("2026-11-23T01:30:00Z")), "2026-11-22");
    assert.equal(fechaArgentina(new Date("2026-11-23T03:30:00Z")), "2026-11-23");
  });
});

describe("proyectarEnDomo", () => {
  it("el cenit va al centro", () => {
    const p = proyectarEnDomo(90, 123, 100);
    assert.ok(cerca(p.x, 0) && cerca(p.y, 0));
  });

  it("horizonte en el borde: norte arriba, sur abajo, este a la izquierda, oeste a la derecha", () => {
    const n = proyectarEnDomo(0, 0, 100);
    const e = proyectarEnDomo(0, 90, 100);
    const s = proyectarEnDomo(0, 180, 100);
    const o = proyectarEnDomo(0, 270, 100);
    assert.ok(cerca(n.x, 0) && cerca(n.y, -100));
    assert.ok(cerca(e.x, -100) && cerca(e.y, 0));
    assert.ok(cerca(s.x, 0) && cerca(s.y, 100));
    assert.ok(cerca(o.x, 100) && cerca(o.y, 0));
  });

  it("45° de altura queda a mitad del radio", () => {
    const p = proyectarEnDomo(45, 0, 100);
    assert.ok(cerca(Math.hypot(p.x, p.y), 50));
  });
});

describe("rumbo y altura", () => {
  it("convierte acimut a rumbo de 8 puntos", () => {
    assert.equal(rumbo(0), "norte");
    assert.equal(rumbo(30.08), "noreste");
    assert.equal(rumbo(105.4), "este");
    assert.equal(rumbo(177.9), "sur");
    assert.equal(rumbo(352.9), "norte");
    assert.equal(rumbo(-90), "oeste");
  });

  it("describe la altura", () => {
    assert.equal(describirAltura(-2), "bajo el horizonte");
    assert.equal(describirAltura(6.7), "muy bajo, cerca del horizonte");
    assert.equal(describirAltura(40.8), "a media altura");
    assert.equal(describirAltura(65.2), "alto en el cielo");
    assert.equal(describirAltura(85), "casi sobre tu cabeza");
  });
});

describe("luz del cielo", () => {
  const PURMAMARCA = { latitude: -23.744, longitude: -65.499 };

  it("clasifica por altura del Sol", () => {
    assert.equal(luzDelCielo(10), "dia");
    assert.equal(luzDelCielo(-5), "crepusculo");
    assert.equal(luzDelCielo(-20), "noche");
  });

  it("mediodía es de día y la noche de demo es de noche en Purmamarca", () => {
    assert.equal(luzDelCielo(sunAltitudeDeg(PURMAMARCA, "2026-11-22T13:00:00-03:00")), "dia");
    assert.equal(luzDelCielo(sunAltitudeDeg(PURMAMARCA, "2026-11-22T22:00:00-03:00")), "noche");
  });
});
