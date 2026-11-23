// Tests de «Próximo paso visible» (lógica pura): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cuentaRegresiva, leerPasos, momentoLocal, proximoPaso } from "./proximo.ts";

const T0 = Date.parse("2026-12-06T00:00:00Z"); // 21:00 en Jujuy
const min = (n) => new Date(T0 + n * 60_000).toISOString();
/** Un paso que aparece en el minuto `inicio`, llega al máximo en `maximo` y deja de verse en `termina`. */
const paso = (inicio, maximo, termina, extra = {}) => ({
  nombre: "X",
  satelites: 1,
  intervaloSeg: 0,
  inicio: min(inicio),
  maximo: min(maximo),
  fin: min(maximo),
  termina: min(termina),
  alturaMaxDeg: 40,
  desdeAzDeg: 200,
  hastaAzDeg: 40,
  recienLanzado: false,
  ...extra,
});
const estacion = (...a) => ({ fuente: "estacion", paso: paso(...a) });
const starlink = (...a) => ({ fuente: "starlink", paso: paso(...a) });
const en = (minutos) => T0 + minutos * 60_000;

describe("el próximo paso", () => {
  it("sin pasos en la lista, lo dice", () => {
    assert.deepEqual(proximoPaso([], T0), { estado: "ninguno" });
  });

  it("elige el que aparece antes, sea de la Estación o de Starlink, y dice cuánto falta", () => {
    const lista = [estacion(30, 33, 36), starlink(10, 12, 14), starlink(50, 52, 54)];
    const p = proximoPaso(lista, T0);
    assert.equal(p.estado, "por-venir");
    assert.equal(p.fuente, "starlink");
    assert.equal(p.paso.inicio, min(10));
    assert.equal(p.faltanMs, 10 * 60_000);

    const despues = proximoPaso(lista, en(20));
    assert.equal(despues.fuente, "estacion");
    assert.equal(despues.faltanMs, 10 * 60_000);
  });

  it("la cuenta llega a cero y el paso queda en curso hasta que deja de verse", () => {
    const lista = [estacion(30, 33, 36), starlink(50, 52, 54)];
    assert.equal(proximoPaso(lista, en(30) - 1).estado, "por-venir");
    for (const t of [en(30), en(33), en(36)]) {
      const p = proximoPaso(lista, t);
      assert.equal(p.estado, "en-curso", new Date(t).toISOString());
      assert.equal(p.fuente, "estacion");
    }
    const siguiente = proximoPaso(lista, en(36) + 1);
    assert.equal(siguiente.estado, "por-venir");
    assert.equal(siguiente.fuente, "starlink");
  });

  it("una fila larga en curso no tapa la cuenta del paso que viene; sin nada por venir, se anuncia", () => {
    // 17 Starlink en fila durante una hora, y la Estación a mitad de esa hora.
    const fila = { fuente: "starlink", paso: paso(0, 2, 60, { satelites: 17, intervaloSeg: 218, fin: min(58) }) };
    const lista = [fila, estacion(30, 33, 36)];
    const antes = proximoPaso(lista, en(10));
    assert.equal(antes.estado, "por-venir");
    assert.equal(antes.fuente, "estacion");
    assert.equal(antes.faltanMs, 20 * 60_000);
    assert.equal(proximoPaso(lista, en(33)).fuente, "estacion");
    const despues = proximoPaso(lista, en(40));
    assert.equal(despues.estado, "en-curso");
    assert.equal(despues.fuente, "starlink");
    assert.deepEqual(proximoPaso(lista, en(60) + 1), { estado: "pasaron" });
  });

  it("un paso de hasta 15 minutos sí se anuncia mientras dura, aunque venga otro", () => {
    const lista = [starlink(0, 7, 15), estacion(20, 23, 26)];
    assert.equal(proximoPaso(lista, en(10)).estado, "en-curso");
    const largo = [starlink(0, 7, 15.5), estacion(20, 23, 26)];
    assert.equal(proximoPaso(largo, en(10)).estado, "por-venir");
  });

  it("cuando terminó el último, los pasos ya pasaron", () => {
    const lista = [estacion(30, 33, 36), starlink(50, 52, 54)];
    assert.deepEqual(proximoPaso(lista, en(54) + 1), { estado: "pasaron" });
  });

  it("una respuesta vieja sin «termina» se da por terminada en el punto más alto del último", () => {
    const viejo = { fuente: "starlink", paso: paso(10, 12, 0, { termina: undefined, fin: min(15), satelites: 5 }) };
    assert.equal(proximoPaso([viejo], en(15)).estado, "en-curso");
    assert.equal(proximoPaso([viejo], en(15) + 1).estado, "pasaron");
  });

  it("si dos aparecen a la vez, primero la Estación; entre dos Starlink, el más alto", () => {
    const juntos = [starlink(10, 12, 14, { alturaMaxDeg: 80 }), estacion(10, 12, 14, { alturaMaxDeg: 25 })];
    assert.equal(proximoPaso(juntos, T0).fuente, "estacion");
    assert.equal(proximoPaso(juntos, en(11)).fuente, "estacion");
    const dos = [starlink(10, 12, 14, { alturaMaxDeg: 30, nombre: "BAJO" }), starlink(10, 12, 14, { alturaMaxDeg: 70, nombre: "ALTO" })];
    assert.equal(proximoPaso(dos, T0).paso.nombre, "ALTO");
    assert.equal(proximoPaso(dos, en(11)).paso.nombre, "ALTO");
  });

  it("ignora un paso con la hora rota en vez de mostrar una cuenta sin sentido", () => {
    const roto = { fuente: "estacion", paso: paso(5, 6, 7, { inicio: "no es una fecha" }) };
    assert.deepEqual(proximoPaso([roto], T0), { estado: "ninguno" });
    assert.equal(proximoPaso([roto, starlink(10, 12, 14)], T0).fuente, "starlink");
  });
});

describe("la cuenta regresiva", () => {
  it("muestra horas, minutos y segundos según lo que falte", () => {
    assert.equal(cuentaRegresiva(45_000), "45 s");
    assert.equal(cuentaRegresiva(12 * 60_000 + 5_000), "12 min 05 s");
    assert.equal(cuentaRegresiva(3600_000 + 2 * 60_000 + 5_000), "1 h 02 min 05 s");
    assert.equal(cuentaRegresiva(60_000), "1 min 00 s");
    assert.equal(cuentaRegresiva(3600_000), "1 h 00 min 00 s");
  });

  it("redondea hacia arriba: mientras falte algo no dice 0 s", () => {
    assert.equal(cuentaRegresiva(1), "1 s");
    assert.equal(cuentaRegresiva(59_001), "1 min 00 s");
  });

  it("nunca baja de cero ni muestra NaN", () => {
    assert.equal(cuentaRegresiva(0), "0 s");
    assert.equal(cuentaRegresiva(-5_000), "0 s");
    assert.equal(cuentaRegresiva(NaN), "0 s");
  });
});

describe("fecha y hora de Jujuy para el enlace a /cielo", () => {
  it("pasa de UTC a UTC−3: antes de las 03:00 UTC todavía es el día anterior", () => {
    assert.deepEqual(momentoLocal("2026-12-06T00:11:18.794Z"), { fecha: "2026-12-05", hora: "21:11" });
  });

  it("un paso después de la medianoche local lleva la fecha del día siguiente", () => {
    assert.deepEqual(momentoLocal("2026-12-06T03:10:00.000Z"), { fecha: "2026-12-06", hora: "00:10" });
  });

  it("con una fecha rota devuelve null en vez de romper la página", () => {
    assert.equal(momentoLocal("no es una fecha"), null);
    assert.equal(momentoLocal(undefined), null);
  });
});

describe("la respuesta de la API antes de dibujarla", () => {
  const buena = () => ({
    desde: min(-30),
    hasta: min(210),
    totalPasos: 2,
    tleActualizado: "2026-11-22T13:24:24.463Z",
    destacados: [paso(10, 12, 14), paso(30, 33, 36, { satelites: 5, intervaloSeg: 40, recienLanzado: true })],
  });

  it("una respuesta completa pasa tal cual", () => {
    assert.deepEqual(leerPasos(buena()), buena());
    assert.deepEqual(leerPasos({ ...buena(), destacados: [] }).destacados, []);
  });

  it("a una respuesta vieja sin «termina» se le pone el máximo del último de la fila", () => {
    const vieja = buena();
    delete vieja.destacados[1].termina;
    vieja.destacados[1].fin = min(35);
    assert.equal(leerPasos(vieja).destacados[1].termina, min(35));
    assert.equal(leerPasos(vieja).destacados[0].termina, min(14));
  });

  it("lo que no es una respuesta de pasos devuelve null", () => {
    for (const x of [null, undefined, "texto", 7, [], {}, { error: "Las órbitas no están disponibles." }]) assert.equal(leerPasos(x), null, JSON.stringify(x));
  });

  it("una fecha rota o un número que falta en cualquier campo devuelve null", () => {
    const rota = (cambio) => {
      const r = buena();
      cambio(r);
      return leerPasos(r);
    };
    assert.equal(rota((r) => (r.desde = "ayer")), null);
    assert.equal(rota((r) => (r.hasta = null)), null);
    assert.equal(rota((r) => (r.tleActualizado = 1795359600000)), null);
    assert.equal(rota((r) => (r.totalPasos = "2")), null);
    assert.equal(rota((r) => (r.destacados = "ninguno")), null);
    assert.equal(rota((r) => (r.destacados[1] = null)), null);
    assert.equal(rota((r) => (r.destacados[0].inicio = "no es una fecha")), null);
    assert.equal(rota((r) => (r.destacados[0].maximo = undefined)), null);
    assert.equal(rota((r) => (r.destacados[0].fin = "")), null);
    assert.equal(rota((r) => (r.destacados[0].termina = "mañana")), null);
    assert.equal(rota((r) => (r.destacados[0].nombre = 42)), null);
    for (const campo of ["satelites", "intervaloSeg", "alturaMaxDeg", "desdeAzDeg", "hastaAzDeg"]) {
      assert.equal(rota((r) => (r.destacados[1][campo] = NaN)), null, campo);
      assert.equal(rota((r) => delete r.destacados[1][campo]), null, campo);
    }
  });

  it("«recienLanzado» solo vale si viene como true", () => {
    const r = buena();
    r.destacados[0].recienLanzado = "sí";
    assert.equal(leerPasos(r).destacados[0].recienLanzado, false);
    assert.equal(leerPasos(r).destacados[1].recienLanzado, true);
  });
});
