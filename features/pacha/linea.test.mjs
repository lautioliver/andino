// Tests de la línea de la noche: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineaDeLaNoche } from "./linea.ts";

const PURMAMARCA = { latitude: -23.7333, longitude: -65.4833 };
const hora = (iso) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Jujuy", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const minutos = (a, b) => (new Date(b) - new Date(a)) / 60_000;

describe("línea de la noche", () => {
  it("ordena puesta, cielo oscuro y alba, con horas de una noche de verano en la Quebrada", () => {
    const l = lineaDeLaNoche(PURMAMARCA, "2026-11-22");
    const tipos = l.eventos.map((e) => e.tipo);
    assert.ok(tipos.indexOf("puesta") < tipos.indexOf("oscuro"));
    assert.equal(tipos.at(-1), "alba");
    const puesta = l.eventos.find((e) => e.tipo === "puesta");
    const oscuro = l.eventos.find((e) => e.tipo === "oscuro");
    assert.match(hora(puesta.iso), /^19:[3-5]\d$/);
    // El crepúsculo astronómico dura bastante más de una hora en esta latitud.
    assert.ok(minutos(puesta.iso, oscuro.iso) > 60 && minutos(puesta.iso, oscuro.iso) < 100);
  });

  it("con Luna llena, arriba de la puesta al alba, no hay eventos de Luna ni tramo sin Luna", () => {
    const l = lineaDeLaNoche(PURMAMARCA, "2026-11-23");
    assert.ok(!l.eventos.some((e) => e.tipo.endsWith("luna")));
    assert.equal(l.sinLuna, null);
  });

  it("si la Luna sale de madrugada, el tramo sin Luna termina cuando sale", () => {
    const l = lineaDeLaNoche(PURMAMARCA, "2026-11-30");
    const salida = l.eventos.find((e) => e.tipo === "salida-luna");
    assert.ok(salida);
    assert.ok(Math.abs(minutos(l.sinLuna.hasta, salida.iso)) <= 5);
  });

  it("en luna nueva, casi toda la noche oscura queda sin Luna", () => {
    const l = lineaDeLaNoche(PURMAMARCA, "2026-12-09");
    const oscuro = l.eventos.find((e) => e.tipo === "oscuro");
    const alba = l.eventos.find((e) => e.tipo === "alba");
    assert.ok(l.sinLuna);
    assert.ok(minutos(l.sinLuna.desde, l.sinLuna.hasta) > 0.8 * minutos(oscuro.iso, alba.iso));
  });

  it("la Luna solo aparece si sale o se pone antes del alba", () => {
    for (const fecha of ["2026-11-22", "2026-11-30", "2026-12-09"]) {
      const l = lineaDeLaNoche(PURMAMARCA, fecha);
      const alba = l.eventos.find((e) => e.tipo === "alba").iso;
      for (const e of l.eventos.filter((x) => x.tipo.endsWith("luna"))) assert.ok(e.iso < alba, `${fecha} ${e.tipo}`);
    }
  });
});
