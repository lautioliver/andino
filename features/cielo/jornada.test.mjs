// Tests de las horas del día y la noche: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { horaLocal, jornada, momento } from "./jornada.ts";

// Purmamarca a 2300 m. Referencia: 22/11/2026, la noche de la demo.
const PURMAMARCA = { latitude: -23.7333, longitude: -65.4833, heightMeters: 2300 };
const FECHA = "2026-11-22";

/** Minutos entre una hora ISO y "HH:MM" en UTC−3 del día dado (o del siguiente). */
function minutosDe(iso, dia, hhmm) {
  return Math.abs(new Date(iso).getTime() - new Date(`${dia}T${hhmm}:00-03:00`).getTime()) / 60000;
}

describe("jornada (Purmamarca, 22/11/2026)", () => {
  const j = jornada(PURMAMARCA, FECHA);
  const casos = [
    ["ocaso", j.ocaso, "2026-11-22", "19:48"],
    ["fin del crepúsculo civil", j.finCivil, "2026-11-22", "20:14"],
    ["noche cerrada", j.nocheCerrada, "2026-11-22", "21:14"],
    ["amanecer", j.amanecer, "2026-11-23", "06:27"],
    ["sale la Luna", j.luna.sale, "2026-11-22", "17:59"],
    ["se pone la Luna", j.luna.sePone, "2026-11-23", "05:10"],
  ];
  for (const [nombre, iso, dia, hhmm] of casos) {
    it(`${nombre} ≈ ${hhmm}`, () => {
      assert.ok(iso, `${nombre} vino vacío`);
      assert.ok(minutosDe(iso, dia, hhmm) <= 1.5, `${nombre}: ${iso}`);
    });
  }

  it("las horas vienen en UTC−3", () => {
    assert.match(j.ocaso, /-03:00$/);
  });

  it("orden de la noche: ocaso < fin civil < noche cerrada < amanecer", () => {
    const t = [j.ocaso, j.finCivil, j.nocheCerrada, j.amanecer].map((s) => new Date(s).getTime());
    assert.deepEqual([...t].sort((a, b) => a - b), t);
  });

  it("Luna casi llena: 96 %", () => {
    assert.equal(Math.round(j.luna.iluminada * 100), 96);
  });

  // Contraste independiente: algoritmo de la hoja de cálculo solar de NOAA, con
  // cenit 90,833° (refracción + semidiámetro). Da 19:49:30; fin civil (96°) 20:14:13
  // y noche cerrada (108°) 21:14:11. No se aplica la depresión del horizonte por
  // altura (+7 min): en la Quebrada los cerros tapan el Sol antes que eso.
  it("el ocaso coincide con NOAA (19:49:30) en ±1 min", () => {
    const noaa = new Date("2026-11-22T19:49:30-03:00").getTime();
    assert.ok(Math.abs(new Date(j.ocaso).getTime() - noaa) <= 60_000, j.ocaso);
  });
});

describe("horaLocal", () => {
  it("redondea al minuto en UTC−3", () => {
    assert.equal(horaLocal("2026-11-22T22:48:58.000Z"), "19:49");
    assert.equal(horaLocal("2026-11-23T09:27:17.000Z"), "06:27");
  });
});

describe("momento", () => {
  const casos = [
    ["2026-11-22T15:00:00-03:00", "dia"],
    ["2026-11-22T19:30:00-03:00", "dia"],
    ["2026-11-22T20:00:00-03:00", "atardecer"],
    ["2026-11-22T20:40:00-03:00", "atardecer"],
    ["2026-11-22T22:00:00-03:00", "noche"],
    ["2026-11-23T03:00:00-03:00", "noche"],
    ["2026-11-23T06:00:00-03:00", "atardecer"],
  ];
  for (const [iso, esperado] of casos) {
    it(`${iso.slice(11, 16)} → ${esperado}`, () => {
      assert.equal(momento(PURMAMARCA, iso), esperado);
    });
  }
});

describe("jornada sin evento", () => {
  // Polo sur en diciembre: el Sol no se pone.
  it("devuelve null en vez de inventar una hora", () => {
    const j = jornada({ latitude: -89, longitude: 0 }, "2026-12-21");
    assert.equal(j.ocaso, null);
    assert.equal(j.nocheCerrada, null);
  });
});
