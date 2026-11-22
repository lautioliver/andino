// Tests de la Yacana: `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { mejorMomentoYacana, posicionDeLosOjos, YACANA } from "./andino.ts";
import { aHorizonte, matrizHorizonte, refraccion } from "./firmamento.ts";

const PURMAMARCA = { latitude: -23.744, longitude: -65.499 };

const horaArgentina = (iso) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Jujuy", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

describe("dónde está la Yacana", () => {
  it("los ojos caen sobre α y β Centauri del catálogo que dibuja Cielo", () => {
    const { estrellas } = JSON.parse(readFileSync(new URL("../../data/cielo/catalogo.json", import.meta.url), "utf8"));
    for (const [ar, dec] of YACANA.ojos) {
      // [ar, dec, magnitud, B−V]; α y β Cen son de las más brillantes del cielo (mag < 1).
      const estrella = estrellas.find(([a, d, mag]) => mag < 1 && Math.abs(a - ar) < 0.05 && Math.abs(d - dec) < 0.05);
      assert.ok(estrella, `sin estrella brillante en ${ar}, ${dec}`);
    }
  });

  it("la etiqueta está en la Vía Láctea, entre la Cruz del Sur (AR ≈ 187°) y ε Sco (AR ≈ 252,5°)", () => {
    const [ar, dec] = YACANA.etiqueta;
    assert.ok(ar > 187 && ar < 252.5, `ar ${ar}`);
    assert.ok(dec > -63 && dec < -34, `dec ${dec}`);
  });

  it("coincide con aHorizonte, el que usa SkyCanvas para dibujar (sin la refracción)", () => {
    for (const iso of ["2026-05-15T23:00:00-03:00", "2026-11-22T21:00:00-03:00", "2026-08-01T19:30:00-03:00"]) {
      const m = matrizHorizonte(PURMAMARCA, iso);
      posicionDeLosOjos(PURMAMARCA, iso).forEach((p, i) => {
        const [ar, dec] = YACANA.ojos[i];
        const h = aHorizonte(m, ar, dec);
        const altGeometrica = h.alt - refraccion(p.alt);
        assert.ok(Math.abs(altGeometrica - p.alt) < 0.05, `${iso} ojo ${i}: alt ${p.alt} vs ${altGeometrica}`);
        assert.ok(Math.abs(h.az - p.az) < 0.05, `${iso} ojo ${i}: az ${p.az} vs ${h.az}`);
      });
    }
  });

  it("α Cen culmina al sur a unos 53° desde Purmamarca (90 − |−23,7 − (−60,8)|)", () => {
    // TSL = AR de α Cen (14,66 h) cerca de las 00:30 del 15/5 en Jujuy.
    let maxAlt = -90;
    let azEnMax = 0;
    for (let min = 0; min <= 180; min += 5) {
      const iso = new Date(new Date("2026-05-14T23:00:00-03:00").getTime() + min * 60_000).toISOString();
      const [alfa] = posicionDeLosOjos(PURMAMARCA, iso);
      if (alfa.alt > maxAlt) [maxAlt, azEnMax] = [alfa.alt, alfa.az];
    }
    assert.ok(Math.abs(maxAlt - 52.9) < 0.5, `alt ${maxAlt}`);
    assert.ok(Math.abs(azEnMax - 180) < 5, `az ${azEnMax}`);
  });
});

describe("la mejor hora para ver los ojos", () => {
  it("en otoño, alta y al sur cerca de la medianoche", () => {
    const m = mejorMomentoYacana(PURMAMARCA, "2026-05-14");
    assert.ok(m);
    const hora = horaArgentina(m.datetimeISO);
    assert.ok(hora >= "23:30" || hora <= "01:30", hora);
    assert.ok(m.alt > 50, `alt ${m.alt}`);
    assert.ok(m.az > 170 && m.az < 190, `az ${m.az}`);
  });

  it("en invierno, culminan apenas oscurece", () => {
    const m = mejorMomentoYacana(PURMAMARCA, "2026-07-15");
    assert.ok(m);
    const hora = horaArgentina(m.datetimeISO);
    assert.ok(hora >= "19:50" && hora <= "20:50", hora);
    assert.ok(m.alt > 50, `alt ${m.alt}`);
  });

  it("a fines de noviembre solo asoman bajos al sudeste, antes del amanecer", () => {
    const m = mejorMomentoYacana(PURMAMARCA, "2026-11-22");
    assert.ok(m);
    const hora = horaArgentina(m.datetimeISO);
    assert.ok(hora >= "04:30" && hora <= "06:00", hora);
    assert.ok(m.alt < 25, `alt ${m.alt}`);
    assert.ok(m.az > 120 && m.az < 170, `az ${m.az}`);
  });

  it("a principios de noviembre no suben con cielo oscuro: null en vez de inventar", () => {
    // Se ponen antes de que oscurezca y salen cuando ya clarea.
    assert.equal(mejorMomentoYacana(PURMAMARCA, "2026-11-01"), null);
  });

  it("solo cuenta horas con los dos ojos arriba de la altura mínima", () => {
    const m = mejorMomentoYacana(PURMAMARCA, "2026-05-14", 10);
    for (const p of posicionDeLosOjos(PURMAMARCA, m.datetimeISO)) assert.ok(p.alt >= 10);
    assert.equal(mejorMomentoYacana(PURMAMARCA, "2026-05-14", 60), null);
  });
});
