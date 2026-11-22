// Tests de «Cuándo», la mejor noche del viaje: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jornada } from "../cielo/jornada.ts";
import { computeSky, sunAltitudeDeg } from "../cielo/motor.ts";
import { fechasDesde, hora, mejorNoche, nocheDeCielo, PASO_MIN, tramoMasLargo } from "./cuando.ts";

const PURMAMARCA = { latitude: -23.7333, longitude: -65.4833 };
const minutos = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;

describe("una noche", () => {
  it("con Luna casi llena toda la noche (22/11/2026) no hay franja oscura", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-22");
    assert.equal(n.minutosOscuros, 0);
    assert.equal(n.franja, null);
    assert.ok(n.lunaIluminada > 0.95);
  });

  it("la noche cerrada coincide con jornada.ts dentro del paso del barrido", () => {
    for (const fecha of ["2026-11-22", "2026-12-07"]) {
      const n = nocheDeCielo(PURMAMARCA, fecha);
      const j = jornada(PURMAMARCA, fecha);
      assert.ok(minutos(n.nocheCerrada, j.nocheCerrada) <= PASO_MIN, `${fecha}: ${n.nocheCerrada} vs ${j.nocheCerrada}`);
    }
  });

  it("con Luna menguante (29/11) la franja termina cuando sale la Luna", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-29");
    const sale = jornada(PURMAMARCA, "2026-11-29").luna.sale;
    assert.ok(n.franja, "no hubo franja");
    assert.equal(n.franja.desde, n.nocheCerrada);
    assert.ok(minutos(n.franja.hasta, sale) <= PASO_MIN, `${n.franja.hasta} vs salida ${sale}`);
  });

  it("en el medio de la franja el Sol está bajo −18° y la Luna bajo el horizonte (contra motor.ts)", () => {
    for (const fecha of ["2026-11-29", "2026-12-03", "2026-12-14"]) {
      const { franja } = nocheDeCielo(PURMAMARCA, fecha);
      const medio = new Date((new Date(franja.desde).getTime() + new Date(franja.hasta).getTime()) / 2).toISOString();
      assert.ok(sunAltitudeDeg(PURMAMARCA, medio) < -18, `${fecha}: Sol`);
      const luna = computeSky(PURMAMARCA, medio).find((o) => o.id === "luna");
      assert.equal(luna.isAboveHorizon, false, `${fecha}: Luna a ${luna.altitudeDeg}°`);
    }
  });

  it("con Luna creciente (14/12) la franja empieza cuando se pone la Luna y llega al alba", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-12-14");
    const sePone = jornada(PURMAMARCA, "2026-12-14").luna.sePone;
    assert.ok(minutos(n.franja.desde, sePone) <= PASO_MIN, `${n.franja.desde} vs puesta ${sePone}`);
    assert.equal(n.franja.hasta, n.alba);
  });

  it("los minutos oscuros nunca superan la noche astronómica", () => {
    for (const fecha of fechasDesde("2026-11-22", 30)) {
      const n = nocheDeCielo(PURMAMARCA, fecha);
      assert.ok(n.minutosOscuros <= minutos(n.nocheCerrada, n.alba), fecha);
    }
  });

  it("donde no oscurece del todo devuelve null en vez de inventar horas", () => {
    // Ushuaia en el solsticio: el Sol no baja de −18°.
    const n = nocheDeCielo({ latitude: -54.8, longitude: -68.3 }, "2026-12-21");
    assert.equal(n.nocheCerrada, null);
    assert.equal(n.alba, null);
    assert.equal(n.minutosOscuros, 0);
    assert.equal(n.franja, null);
  });
});

describe("la mejor noche del viaje", () => {
  it("entre 22/11 y 15/12 elige la de Luna nueva y no la de Luna llena", () => {
    const { noches, mejor } = mejorNoche(PURMAMARCA, fechasDesde("2026-11-22", 24));
    assert.equal(noches.length, 24);
    assert.ok(mejor.lunaIluminada < 0.05, `${mejor.fecha}: ${mejor.lunaIluminada}`);
    assert.ok(noches.every((n) => n.minutosOscuros <= mejor.minutosOscuros));
  });

  it("en un viaje de una semana con Luna menguando, la mejor es la última noche", () => {
    const { mejor } = mejorNoche(PURMAMARCA, fechasDesde("2026-11-24", 7));
    assert.equal(mejor.fecha, "2026-11-30");
  });

  it("si empatan en minutos, gana la de Luna más fina", () => {
    const { noches, mejor } = mejorNoche(PURMAMARCA, fechasDesde("2026-12-05", 3));
    assert.equal(new Set(noches.map((n) => n.minutosOscuros)).size, 1, "este caso necesita un empate");
    assert.equal(mejor.fecha, "2026-12-07");
  });

  it("sin noches oscuras no hay mejor", () => {
    assert.equal(mejorNoche(PURMAMARCA, fechasDesde("2026-11-22", 3)).mejor, null);
    assert.equal(mejorNoche(PURMAMARCA, []).mejor, null);
  });
});

describe("utilidades", () => {
  it("tramoMasLargo elige el tramo más largo, no el primero, e incluye el que llega al final", () => {
    const [V, F] = [true, false];
    assert.deepEqual(tramoMasLargo([V, F, V, V, F]), { desde: 2, hasta: 4 });
    assert.deepEqual(tramoMasLargo([F, V, F, V, V, V]), { desde: 3, hasta: 6 });
    assert.deepEqual(tramoMasLargo([V, V, F, V, V]), { desde: 0, hasta: 2 });
    assert.equal(tramoMasLargo([F, F]), null);
    assert.equal(tramoMasLargo([]), null);
  });

  it("fechasDesde cruza meses y años", () => {
    assert.deepEqual(fechasDesde("2026-12-30", 3), ["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
  it("hora da HH:MM en UTC−3", () => {
    assert.equal(hora("2026-11-30T01:35:00-03:00"), "01:35");
    assert.equal(hora("2026-11-30T04:35:00.000Z"), "01:35");
  });
});
