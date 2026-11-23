// Tests de la regla de respaldo de los TLE (lógica pura, sin red): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limpiarTle, RESPALDO_FRESCO_MS, RESPALDO_MAXIMO_MS, tleConRespaldo, VIDA_TLE } from "./respaldo.ts";

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
    assert.equal(await tleConRespaldo(o), VIEJO);
    assert.equal(o.bajadas, 0);
    assert.deepEqual(o.guardados, []);
  });

  it("con un respaldo de 2 horas o más se baja una vez y se guarda la copia nueva", async () => {
    const o = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_FRESCO_MS } });
    assert.equal(await tleConRespaldo(o), BUENO);
    assert.equal(o.bajadas, 1);
    assert.deepEqual(o.guardados, [BUENO]);
  });

  it("sin respaldo se baja y se guarda", async () => {
    const o = origen();
    assert.equal(await tleConRespaldo(o), BUENO);
    assert.equal(o.bajadas, 1);
    assert.deepEqual(o.guardados, [BUENO]);
  });

  it("guarda el texto sin el relleno ni los \\r\\n con que llega de CelesTrak", async () => {
    const o = origen({ baja: "ISS (ZARYA)             \r\n1 25544U ...\r\n2 25544 ...\r\n" });
    assert.equal(await tleConRespaldo(o), BUENO);
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
    assert.equal(await tleConRespaldo(o), VIEJO);
    assert.equal(o.bajadas, 1);
    assert.deepEqual(o.guardados, []);
    assert.equal(o.avisos.length, 1);
    assert.match(o.avisos[0], /respaldo de hace 72 h/);
  });

  it("con un respaldo de más de 3 días falla: esas órbitas ya no sirven", async () => {
    const o = origen({ respaldo: { texto: VIEJO, edadMs: RESPALDO_MAXIMO_MS }, baja: caido });
    await assert.rejects(tleConRespaldo(o), /CelesTrak 403/);
  });

  it("sin respaldo falla con el error de CelesTrak", async () => {
    await assert.rejects(tleConRespaldo(origen({ baja: caido })), /CelesTrak 403/);
  });

  it("una página de error con estado 200 no se guarda ni se usa", async () => {
    const sinRespaldo = origen({ baja: "No GP data found" });
    await assert.rejects(tleConRespaldo(sinRespaldo), /respuesta inesperada/);
    assert.deepEqual(sinRespaldo.guardados, []);

    const conRespaldo = origen({ respaldo: { texto: VIEJO, edadMs: 5 * HORA }, baja: "No GP data found" });
    assert.equal(await tleConRespaldo(conRespaldo), VIEJO);
    assert.deepEqual(conRespaldo.guardados, []);
  });
});

describe("respaldo dañado o que no se puede guardar", () => {
  it("un respaldo que no es el set esperado se ignora aunque sea reciente", async () => {
    const o = origen({ respaldo: { texto: "<html>error</html>", edadMs: 1000 } });
    assert.equal(await tleConRespaldo(o), BUENO);
    assert.equal(o.bajadas, 1);

    const caido = origen({ respaldo: { texto: "<html>error</html>", edadMs: 1000 }, baja: new Error("CelesTrak 403") });
    await assert.rejects(tleConRespaldo(caido), /CelesTrak 403/);
  });

  it("si no se puede guardar la copia, igual devuelve lo que bajó", async () => {
    const o = origen({
      respaldo: { texto: VIEJO, edadMs: 5 * HORA },
      guardar: async () => {
        throw new Error("Blob caído");
      },
    });
    assert.equal(await tleConRespaldo(o), BUENO);
    assert.equal(o.avisos.length, 1);
  });
});

describe("limpiarTle", () => {
  it("deja tres líneas por satélite, sin espacios de relleno ni líneas vacías", () => {
    assert.equal(limpiarTle("  A   \r\n1 x\r\n2 y\r\n\r\n B\n1 z\n2 w\n\n"), "A\n1 x\n2 y\nB\n1 z\n2 w");
    assert.equal(limpiarTle(""), "");
  });
});
