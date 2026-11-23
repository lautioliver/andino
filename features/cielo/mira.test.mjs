// Tests de la mira de «Ver con la cámara» (qué hay en el centro de la pantalla): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enLaMira, RADIO_MIRA, separacion, VENTAJA_MIRA } from "./mira.ts";

const cerca = (real, esperado, tol = 1e-6) => assert.ok(Math.abs(real - esperado) <= tol, `${real} vs ${esperado}`);
const objeto = (id, alt, az) => ({ id, tipo: "objeto", alt, az });
const figura = (id, alt, az) => ({ id, tipo: "figura", alt, az });

describe("separacion", () => {
  it("la misma dirección: 0°", () => {
    cerca(separacion({ alt: 33, az: 120 }, { alt: 33, az: 120 }), 0);
    // A estas alturas el coseno de la cuenta redondea apenas por encima de 1: sin acotarlo, daría NaN.
    for (const alt of [2.5, 12, 27, 58, 82]) assert.equal(separacion({ alt, az: 120 }, { alt, az: 120 }), 0);
  });

  it("sobre el horizonte, es la diferencia de rumbo", () => {
    cerca(separacion({ alt: 0, az: 10 }, { alt: 0, az: 100 }), 90);
  });

  it("cruza el norte por el camino corto", () => {
    cerca(separacion({ alt: 0, az: 350 }, { alt: 0, az: 10 }), 20);
  });

  it("del horizonte al cenit hay 90°, mire adonde mire", () => {
    cerca(separacion({ alt: 0, az: 77 }, { alt: 90, az: 301 }), 90);
  });

  it("alto en el cielo, rumbos opuestos quedan cerca: se llega pasando por el cenit", () => {
    cerca(separacion({ alt: 60, az: 0 }, { alt: 60, az: 180 }), 60);
  });

  it("alto en el cielo, la misma diferencia de rumbo separa menos que en el horizonte", () => {
    assert.ok(separacion({ alt: 70, az: 0 }, { alt: 70, az: 40 }) < 15);
  });
});

describe("enLaMira", () => {
  const mirada = { alt: 30, az: 100 };

  it("sin nada cerca, nada", () => {
    assert.equal(enLaMira(mirada, []), null);
    assert.equal(enLaMira(mirada, [objeto("luna", 30, 100 + 40), figura("Ori", 80, 280)]), null);
  });

  it("elige lo más cercano de su tipo", () => {
    assert.equal(enLaMira(mirada, [figura("Ori", 30, 120), figura("Tau", 30, 108), figura("Gem", 45, 100)]).id, "Tau");
    assert.equal(enLaMira(mirada, [objeto("luna", 30, 107), objeto("saturno", 33, 100)]).id, "saturno");
  });

  it("un objeto dentro de su radio le gana a una figura que está más cerca", () => {
    assert.equal(enLaMira(mirada, [figura("Tau", 30, 101), objeto("luna", 30, 108)]).id, "luna");
  });

  it("un objeto fuera de su radio no cuenta: queda la figura", () => {
    const lejos = RADIO_MIRA.objeto + 2;
    assert.equal(enLaMira({ alt: 0.5, az: 100 }, [figura("Tau", 10, 100), objeto("luna", 0.5, 100 + lejos)]).id, "Tau");
  });

  it("una figura cuenta hasta su radio, que es más amplio que el de un objeto", () => {
    assert.ok(RADIO_MIRA.figura > RADIO_MIRA.objeto);
    const enHorizonte = { alt: 0.5, az: 100 };
    assert.equal(enLaMira(enHorizonte, [figura("Tau", 0.5, 100 + RADIO_MIRA.figura - 1)]).id, "Tau");
    assert.equal(enLaMira(enHorizonte, [figura("Tau", 0.5, 100 + RADIO_MIRA.figura + 1)]), null);
    assert.equal(enLaMira(enHorizonte, [objeto("luna", 0.5, 100 + RADIO_MIRA.objeto - 1)]).id, "luna");
    assert.equal(enLaMira(enHorizonte, [objeto("luna", 0.5, 100 + RADIO_MIRA.objeto + 1)]), null);
  });

  it("lo que está bajo el horizonte no cuenta, aunque esté en el centro", () => {
    assert.equal(enLaMira({ alt: -5, az: 100 }, [objeto("acrux", -5, 100), figura("Cru", -2, 100)]), null);
    assert.equal(enLaMira({ alt: -5, az: 100 }, [objeto("acrux", -5, 100), figura("Cen", 8, 100)]).id, "Cen");
  });

  describe("no parpadea entre dos vecinos", () => {
    const tau = figura("Tau", 30, 90);
    const ori = figura("Ori", 30, 110);

    it("sin nada elegido, gana el más cercano por poco que sea", () => {
      assert.equal(enLaMira({ alt: 30, az: 100.5 }, [tau, ori]).id, "Ori");
      assert.equal(enLaMira({ alt: 30, az: 99.5 }, [tau, ori]).id, "Tau");
    });

    it("lo que ya estaba en la mira se queda mientras el otro no le gane por la ventaja", () => {
      assert.equal(enLaMira({ alt: 30, az: 100.5 }, [tau, ori], "Tau").id, "Tau");
      assert.equal(enLaMira({ alt: 30, az: 99.5 }, [tau, ori], "Ori").id, "Ori");
    });

    it("cuando el otro le gana por más que la ventaja, cambia", () => {
      // A 30° de altura, 3° de rumbo son unos 2,6° de cielo para cada lado: el otro queda 5° más cerca.
      assert.ok(VENTAJA_MIRA < 5);
      assert.equal(enLaMira({ alt: 30, az: 103 }, [tau, ori], "Tau").id, "Ori");
    });

    it("en el borde del radio, lo elegido aguanta un poco más antes de soltarse", () => {
      const enHorizonte = { alt: 0.5, az: 100 };
      const luna = objeto("luna", 0.5, 100 + RADIO_MIRA.objeto + 1);
      assert.equal(enLaMira(enHorizonte, [luna]), null);
      assert.equal(enLaMira(enHorizonte, [luna], "luna").id, "luna");
      assert.equal(enLaMira(enHorizonte, [objeto("luna", 0.5, 100 + RADIO_MIRA.objeto + VENTAJA_MIRA + 1)], "luna"), null);
    });
  });
});
