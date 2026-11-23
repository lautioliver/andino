// Tests de la regla de respaldo de los TLE (lógica pura, sin red): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limpiarTle, RESPALDO_FRESCO_MS, RESPALDO_MAXIMO_MS, tleConRespaldo, VIDA_TLE, VIDA_TRAS_FALLO } from "./respaldo.ts";

const HORA = 3_600_000;
const BUENO = "ISS (ZARYA)\n1 25544U ...\n2 25544 ...";
const VIEJO = "ISS (ZARYA)\n1 25544U viejo\n2 25544 viejo";

/** Un origen de mentira que anota qué se le pidió. */
function origen({ respaldo = null, baja = BUENO, guardar = async () => {} } = {}) {
  const o = {
    bajadas: 0,
    guardados: [],
    avisos: [],
    leerRespaldo: async () => respaldo,
    bajar: async () => {
      o.bajadas++;
      if (baja instanceof Error) throw baja;
      return baja;
    },
    guardarRespaldo: async (texto) => {
      o.guardados.push(texto);
      await guardar(texto);
    },
    valido: (texto) => texto.startsWith("ISS"),
    avisar: (mensaje) => o.avisos.push(mensaje),
  };
  return o;
}

describe("cuándo se baja de CelesTrak", () => {
  it("con un respaldo de menos de 2 horas no se llama a CelesTrak", async () => {
    const o = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_FRESCO_MS - 1 } });
    assert.deepEqual(await tleConRespaldo(o), { texto: VIEJO, vida: VIDA_TLE });
    assert.equal(o.bajadas, 0);
    assert.deepEqual(o.guardados, []);
  });

  it("con un respaldo de 2 horas o más se baja una vez y se guarda la copia nueva", async () => {
    const o = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_FRESCO_MS } });
    assert.deepEqual(await tleConRespaldo(o), { texto: BUENO, vida: VIDA_TLE });
    assert.equal(o.bajadas, 1);
    assert.deepEqual(o.guardados, [BUENO]);
  });

  it("sin respaldo se baja y se guarda", async () => {
    const o = origen();
    assert.deepEqual(await tleConRespaldo(o), { texto: BUENO, vida: VIDA_TLE });
    assert.equal(o.bajadas, 1);
    assert.deepEqual(o.guardados, [BUENO]);
  });

  it("guarda el texto sin el relleno ni los \\r\\n con que llega de CelesTrak", async () => {
    const o = origen({ baja: "ISS (ZARYA)             \r\n1 25544U ...\r\n2 25544 ...\r\n" });
    assert.equal((await tleConRespaldo(o)).texto, BUENO);
    assert.deepEqual(o.guardados, [BUENO]);
  });

  it("la caché remota no vuelve a pedir el TLE antes de que venza el respaldo fresco", () => {
    assert.ok(VIDA_TLE.revalidate * 1000 >= RESPALDO_FRESCO_MS);
    assert.ok(VIDA_TLE.expire >= VIDA_TLE.revalidate);
  });
});

describe("cuando CelesTrak falla", () => {
  const caido = new Error("CelesTrak 403");

  it("usa el respaldo aunque sea viejo, hasta 3 días, y avisa", async () => {
    const o = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_MAXIMO_MS - 1 }, baja: caido });
    assert.equal((await tleConRespaldo(o)).texto, VIEJO);
    assert.equal(o.bajadas, 1);
    assert.deepEqual(o.guardados, []);
    assert.equal(o.avisos.length, 1);
    assert.match(o.avisos[0], /respaldo de hace 72 h/);
  });

  it("con un respaldo de más de 3 días no hay órbitas: esas ya no sirven", async () => {
    const o = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_MAXIMO_MS }, baja: caido });
    const obtenido = await tleConRespaldo(o);
    assert.equal(obtenido.texto, null);
    assert.equal(obtenido.fallo, caido);
  });

  it("sin respaldo no hay órbitas, y queda el error de CelesTrak", async () => {
    const obtenido = await tleConRespaldo(origen({ baja: caido }));
    assert.equal(obtenido.texto, null);
    assert.equal(obtenido.fallo, caido);
  });

  it("una página de error con estado 200 no se guarda ni se usa", async () => {
    const sinRespaldo = origen({ baja: "No GP data found" });
    const obtenido = await tleConRespaldo(sinRespaldo);
    assert.equal(obtenido.texto, null);
    assert.match(obtenido.fallo.message, /respuesta inesperada/);
    assert.deepEqual(sinRespaldo.guardados, []);

    const conRespaldo = origen({ respaldo: { texto: VIEJO, edadMs: 5 * HORA }, baja: "No GP data found" });
    assert.equal((await tleConRespaldo(conRespaldo)).texto, VIEJO);
    assert.deepEqual(conRespaldo.guardados, []);
  });
});

describe("el fallo de CelesTrak se recuerda 10 minutos", () => {
  const caido = new Error("CelesTrak 403");

  it("un fallo no rechaza: vuelve como resultado, que es lo único que la caché guarda", async () => {
    await assert.doesNotReject(tleConRespaldo(origen({ baja: caido })));
    await assert.doesNotReject(tleConRespaldo(origen({ baja: "No GP data found" })));
    await assert.doesNotReject(tleConRespaldo(origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_MAXIMO_MS }, baja: caido })));
  });

  it("con respaldo: el respaldo se guarda con la vida corta, no con la de un TLE recién bajado", async () => {
    const obtenido = await tleConRespaldo(origen({ respaldo: { texto: VIEJO, edadMs: 5 * HORA }, baja: caido }));
    assert.deepEqual(obtenido, { texto: VIEJO, vida: VIDA_TRAS_FALLO, fallo: caido });
  });

  it("sin respaldo utilizable: se guarda que no hay órbitas, con la vida corta", async () => {
    assert.deepEqual(await tleConRespaldo(origen({ baja: caido })), { texto: null, vida: VIDA_TRAS_FALLO, fallo: caido });
    const vencido = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_MAXIMO_MS }, baja: caido });
    assert.deepEqual(await tleConRespaldo(vencido), { texto: null, vida: VIDA_TRAS_FALLO, fallo: caido });
  });

  it("una respuesta que no es el set esperado cuenta como fallo", async () => {
    const obtenido = await tleConRespaldo(origen({ respaldo: { texto: VIEJO, edadMs: 5 * HORA }, baja: "No GP data found" }));
    assert.equal(obtenido.texto, VIEJO);
    assert.equal(obtenido.vida, VIDA_TRAS_FALLO);
  });

  it("lo que sale bien se guarda como siempre: recién bajado o respaldo fresco", async () => {
    assert.equal((await tleConRespaldo(origen())).vida, VIDA_TLE);
    assert.equal((await tleConRespaldo(origen({ respaldo: { texto: VIEJO, edadMs: 5 * HORA } }))).vida, VIDA_TLE);
    const fresco = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_FRESCO_MS - 1 }, baja: caido });
    assert.equal((await tleConRespaldo(fresco)).vida, VIDA_TLE);
    assert.equal(fresco.bajadas, 0);
  });

  it("que no se pueda guardar la copia no es un fallo de CelesTrak: lo bajado dura lo de siempre", async () => {
    const o = origen({
      guardar: async () => {
        throw new Error("Blob caído");
      },
    });
    assert.deepEqual(await tleConRespaldo(o), { texto: BUENO, vida: VIDA_TLE });
  });

  it("la vida corta: 10 minutos sin reintentar, y vence antes que la de un TLE", () => {
    assert.equal(VIDA_TRAS_FALLO.revalidate, 600);
    // cacheLife exige expire > revalidate; y con un expire de menos de 5 minutos Next trata la entrada como dinámica.
    assert.ok(VIDA_TRAS_FALLO.expire > VIDA_TRAS_FALLO.revalidate);
    assert.ok(VIDA_TRAS_FALLO.expire >= 300);
    assert.ok(VIDA_TRAS_FALLO.revalidate < VIDA_TLE.revalidate);
    assert.ok(VIDA_TRAS_FALLO.expire < VIDA_TLE.expire);
  });
});

describe("respaldo dañado o que no se puede guardar", () => {
  it("un respaldo que no es el set esperado se ignora aunque sea reciente", async () => {
    const o = origen({ respaldo: { texto: "<html>error</html>", edadMs: 1000 } });
    assert.equal((await tleConRespaldo(o)).texto, BUENO);
    assert.equal(o.bajadas, 1);

    const caido = origen({ respaldo: { texto: "<html>error</html>", edadMs: 1000 }, baja: new Error("CelesTrak 403") });
    assert.equal((await tleConRespaldo(caido)).texto, null);
  });

  it("si no se puede guardar la copia, igual devuelve lo que bajó", async () => {
    const o = origen({
      respaldo: { texto: VIEJO, edadMs: 5 * HORA },
      guardar: async () => {
        throw new Error("Blob caído");
      },
    });
    assert.equal((await tleConRespaldo(o)).texto, BUENO);
    assert.equal(o.avisos.length, 1);
  });
});

describe("limpiarTle", () => {
  it("deja tres líneas por satélite, sin espacios de relleno ni líneas vacías", () => {
    assert.equal(limpiarTle("  A   \r\n1 x\r\n2 y\r\n\r\n B\n1 z\n2 w\n\n"), "A\n1 x\n2 y\nB\n1 z\n2 w");
    assert.equal(limpiarTle(""), "");
  });
});
