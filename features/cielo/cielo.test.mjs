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

describe("URL de /cielo", async () => {
  const { momentoDesdeURL, queryCielo } = await import("./cielo.ts");

  it("acepta fecha y hora válidas", () => {
    assert.deepEqual(momentoDesdeURL("2026-11-23", "03:00"), { fecha: "2026-11-23", hora: "03:00" });
  });

  it("rechaza faltantes o inválidos", () => {
    assert.equal(momentoDesdeURL(null, "03:00"), null);
    assert.equal(momentoDesdeURL("2026-11-23", null), null);
    assert.equal(momentoDesdeURL("23/11/2026", "03:00"), null);
    assert.equal(momentoDesdeURL("2026-11-23", "25:00"), null);
    assert.equal(momentoDesdeURL("2026-13-40", "03:00"), null);
  });

  it("arma la query con o sin momento", () => {
    assert.equal(queryCielo("tilcara", null), "?placeId=tilcara");
    assert.equal(queryCielo("tilcara", { fecha: "2026-11-23", hora: "03:00" }), "?placeId=tilcara&fecha=2026-11-23&hora=03%3A00");
  });
});

describe("escenario de demo", async () => {
  const { DEMO_CIELO } = await import("./cielo.ts");
  const { computeSky } = await import("./motor.ts");
  const { getPlace } = await import("../../data/places.ts");

  it("el lugar de la demo existe en el dataset", () => {
    assert.ok(getPlace(DEMO_CIELO.placeId));
  });

  it("de noche cerrada, los cinco objetos a más de 10° y coincide con JPL Horizons", () => {
    const place = getPlace(DEMO_CIELO.placeId);
    const iso = buildDatetimeISO(DEMO_CIELO.fecha, DEMO_CIELO.hora);
    assert.equal(luzDelCielo(sunAltitudeDeg(place, iso)), "noche");
    const cielo = Object.fromEntries(computeSky(place, iso).map((o) => [o.id, o]));
    for (const o of Object.values(cielo)) assert.ok(o.altitudeDeg > 10, JSON.stringify(o));

    // JPL Horizons (DE441), consultado el 22/11/2026: observador -65.4833 E, -23.7333 N, 0 km,
    // 2026-11-23 06:00 UT, acimut/elevación aparentes con refracción.
    const HORIZONS = {
      luna: { az: 308.536105, alt: 24.475346 },
      jupiter: { az: 65.292817, alt: 18.852222 },
      saturno: { az: 275.609337, alt: 10.551666 },
    };
    for (const [id, ref] of Object.entries(HORIZONS)) {
      assert.ok(Math.abs(cielo[id].altitudeDeg - ref.alt) < 0.05, `${id} ${JSON.stringify(cielo[id])}`);
      assert.ok(Math.abs(cielo[id].azimuthDeg - ref.az) < 0.05, `${id} ${JSON.stringify(cielo[id])}`);
    }
  });
});
