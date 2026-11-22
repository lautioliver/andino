// Tests de «Tu signo en el cielo»: `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { constelacionDelSol, mejorMomento, posicionDelSigno, SIGNOS, signoPorFecha, tuCumpleEnElCielo } from "./signo.ts";

const PURMAMARCA = { latitude: -23.744, longitude: -65.499 };
const NOCHE = "2026-11-22T22:00:00-03:00";

const horaArgentina = (iso) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Jujuy", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

describe("signo del horóscopo", () => {
  it("cubre todos los días del año con un solo signo", () => {
    const dias = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    dias.forEach((n, i) => {
      for (let d = 1; d <= n; d++) assert.ok(signoPorFecha(i + 1, d));
    });
  });

  it("respeta los bordes, incluido el cruce de año de Capricornio", () => {
    assert.equal(signoPorFecha(3, 20).id, "piscis");
    assert.equal(signoPorFecha(3, 21).id, "aries");
    assert.equal(signoPorFecha(12, 31).id, "capricornio");
    assert.equal(signoPorFecha(1, 19).id, "capricornio");
    assert.equal(signoPorFecha(1, 20).id, "acuario");
  });
});

describe("el Sol en tu cumpleaños", () => {
  // Fechas de entrada del Sol a cada constelación según los límites IAU (época actual):
  // Ofiuco ≈ 29/11–17/12, Peces ≈ 12/3–18/4, Leo ≈ 10/8–16/9.
  it("el 30 de noviembre el horóscopo dice Sagitario, pero el Sol está en Ofiuco", () => {
    const r = tuCumpleEnElCielo("2026-11-30");
    assert.equal(r.horoscopo.id, "sagitario");
    assert.deepEqual(constelacionDelSol("2026-11-30"), { id: "Oph", nombre: "Ofiuco" });
    assert.equal(r.coinciden, false);
  });

  it("el 25 de marzo el horóscopo dice Aries, pero el Sol está en Peces", () => {
    const r = tuCumpleEnElCielo("2026-03-25");
    assert.equal(r.horoscopo.id, "aries");
    assert.equal(r.sol.nombre, "Piscis");
  });

  it("a veces coinciden: el 15 de agosto, Leo y Leo", () => {
    assert.equal(tuCumpleEnElCielo("2026-08-15").coinciden, true);
  });

  it("a lo largo del año el Sol pasa solo por las 13 constelaciones con nombre en castellano", () => {
    const vistas = new Set();
    for (let d = 0; d < 365; d += 3) {
      const fecha = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      const sol = constelacionDelSol(fecha);
      assert.notEqual(sol.nombre, undefined);
      assert.match(sol.nombre, /^[A-ZÁÉÍÓÚ][a-záéíóú]+$/, `${fecha}: ${sol.id}`);
      vistas.add(sol.id);
    }
    assert.equal(vistas.size, 13);
  });
});

describe("dónde está tu signo esta noche", () => {
  it("los centros salen del catálogo del cielo, así la figura coincide con lo que dibuja Cielo", () => {
    const catalogo = JSON.parse(readFileSync(new URL("../../data/cielo/catalogo.json", import.meta.url), "utf8"));
    for (const s of SIGNOS) {
      const c = catalogo.constelaciones.find((x) => x.id === s.constelacion);
      assert.ok(c, s.constelacion);
      assert.deepEqual(s.centro, c.etiqueta, s.id);
    }
  });

  it("Piscis culmina al norte a las 22:00 del 22/11 en Purmamarca (TSL ≈ 0,5 h; altura ≈ 90 − |−23,7 − 14|)", () => {
    const p = posicionDelSigno("piscis", PURMAMARCA, NOCHE);
    assert.ok(Math.abs(p.alt - 52.3) < 1.5, `alt ${p.alt}`);
    assert.ok(p.az > 340 || p.az < 20, `az ${p.az}`);
    assert.equal(p.sobreHorizonte, true);
  });

  it("Escorpio ya se puso y Leo todavía no salió", () => {
    assert.equal(posicionDelSigno("escorpio", PURMAMARCA, NOCHE).sobreHorizonte, false);
    assert.equal(posicionDelSigno("leo", PURMAMARCA, NOCHE).sobreHorizonte, false);
  });

  it("la mejor hora para Aries es cerca de su culminación, pasada la medianoche solar", () => {
    const m = mejorMomento("aries", PURMAMARCA, "2026-11-22");
    assert.ok(m);
    const hora = horaArgentina(m.datetimeISO);
    assert.ok(hora >= "23:00" || hora <= "01:00", hora);
    assert.ok(m.posicion.alt > 44, `alt ${m.posicion.alt}`);
  });

  it("solo propone horas de cielo oscuro: Acuario, que se está poniendo, al terminar el crepúsculo", () => {
    const m = mejorMomento("acuario", PURMAMARCA, "2026-11-22");
    assert.ok(m);
    const hora = horaArgentina(m.datetimeISO);
    // Fin del crepúsculo náutico (Sol a −12°) ≈ 20:45 ese día: nunca antes.
    assert.ok(hora >= "20:30" && hora <= "21:15", hora);
  });

  it("si esa noche no sube lo suficiente, devuelve null en vez de inventar", () => {
    assert.equal(mejorMomento("virgo", PURMAMARCA, "2026-11-22"), null);
  });
});
