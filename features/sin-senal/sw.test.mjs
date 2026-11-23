// Tests del service worker (public/sw.js): lo que se puede probar sin navegador. `npm test`.
//
// sw.js no es un módulo (el navegador lo registra como script clásico), así que acá se lo carga con node:vm en
// un contexto con un `self`, unas cachés y una red de mentira. Lo que corre es el archivo tal cual se despliega:
// sus funciones puras se llaman directo y lo demás se prueba entregándole pedidos a su oyente de `fetch`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import vm from "node:vm";

const FUENTE = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const ORIGEN = "https://andino.test";
const AHORA = Date.UTC(2026, 10, 23, 23, 0, 0); // 20:00 en Jujuy
const HORA = 3_600_000;
const GUARDADO = "x-andino-guardado";

const direccion = (req) => new URL(typeof req === "string" ? req : req instanceof URL ? req.href : req.url, ORIGEN).href;

/** Una caché como la del navegador en lo que el service worker usa: por URL, en el orden en que se guardó. */
class CacheFalsa {
  entradas = [];
  async match(req) {
    return this.entradas.find((e) => e.url === direccion(req))?.res.clone();
  }
  async put(req, res) {
    await this.delete(req);
    this.entradas.push({ url: direccion(req), res });
  }
  async delete(req) {
    const antes = this.entradas.length;
    this.entradas = this.entradas.filter((e) => e.url !== direccion(req));
    return this.entradas.length < antes;
  }
  async keys() {
    return this.entradas.map((e) => ({ url: e.url }));
  }
  rutas() {
    return this.entradas.map((e) => e.url.slice(ORIGEN.length));
  }
}

/** Una respuesta como las que da la red a un pedido del mismo origen (`type` "basic"). */
function deLaRed(cuerpo, { status = 200, tipo = "application/json", cabeceras = {} } = {}) {
  const res = new Response(cuerpo, { status, headers: { "content-type": tipo, ...cabeceras } });
  Object.defineProperty(res, "type", { value: "basic" });
  return res;
}
const pagina = (cuerpo, cabeceras) => deLaRed(cuerpo, { tipo: "text/html; charset=utf-8", cabeceras });

function diferida() {
  let ok, mal;
  const promesa = new Promise((a, b) => {
    ok = a;
    mal = b;
  });
  return { promesa, ok, mal };
}
const COLGADA = () => new Promise(() => {}); // acepta el pedido y no contesta nunca
const CAIDA = () => Promise.reject(new TypeError("Failed to fetch"));

/** Carga sw.js. `red(req)` hace de `fetch`: recibe el pedido y devuelve la promesa de su respuesta. */
function cargar(red = COLGADA) {
  const oyentes = {};
  const guardadas = new Map();
  const sw = {
    red,
    pedidos: [],
    async cache(nombre) {
      if (!guardadas.has(nombre)) guardadas.set(nombre, new CacheFalsa());
      return guardadas.get(nombre);
    },
  };
  const contexto = vm.createContext({
    self: {
      addEventListener: (tipo, oyente) => (oyentes[tipo] = oyente),
      skipWaiting() {},
      clients: { claim: async () => {} },
      registration: { unregister: async () => true },
      location: { origin: ORIGEN },
    },
    caches: { open: (nombre) => sw.cache(nombre), keys: async () => [...guardadas.keys()], delete: async (nombre) => guardadas.delete(nombre) },
    fetch: (req, opciones) => {
      sw.pedidos.push(direccion(req).slice(ORIGEN.length));
      return sw.red(req, opciones);
    },
    // Por nombre y en el momento: así valen los relojes de mentira de node:test.
    setTimeout: (...a) => setTimeout(...a),
    clearTimeout: (id) => clearTimeout(id),
    Date: { now: () => Date.now() },
    Response,
    Headers,
    URL,
    AbortSignal,
  });
  vm.runInContext(FUENTE, contexto, { filename: "public/sw.js" });
  sw.fn = contexto; // las funciones de sw.js quedan como propiedades del contexto
  sw.constante = (nombre) => vm.runInContext(nombre, contexto);
  /** Le entrega un pedido al oyente de `fetch`, como hace el navegador. */
  sw.pedir = (ruta, { navega = false, metodo = "GET", cabeceras = {} } = {}) => {
    const evento = {
      request: { url: new URL(ruta, ORIGEN).href, method: metodo, mode: navega ? "navigate" : "cors", cache: "default", headers: new Headers(cabeceras) },
      respuesta: null, // lo que recibió respondWith; null si el service worker dejó pasar el pedido
      esperas: [], // lo que recibió waitUntil
      respondWith: (promesa) => (evento.respuesta = seguir(Promise.resolve(promesa))),
      waitUntil: (promesa) => evento.esperas.push(Promise.resolve(promesa)),
    };
    oyentes.fetch(evento);
    return evento;
  };
  sw.instalar = async () => {
    const esperas = [];
    oyentes.install({ waitUntil: (p) => esperas.push(p) });
    await Promise.all(esperas);
  };
  return sw;
}

/** Para mirar una promesa sin esperarla: `lista` pasa a true cuando se resuelve. */
function seguir(promesa) {
  const s = { lista: false, promesa };
  promesa.then(
    (valor) => Object.assign(s, { lista: true, valor }),
    (error) => Object.assign(s, { lista: true, error }),
  );
  return s;
}

/** Deja correr lo que quedó pendiente (promesas, lecturas de cuerpos) sin mover el reloj. */
async function asentar() {
  for (let i = 0; i < 20; i++) await new Promise((ok) => setImmediate(ok));
}

/** Adelanta el reloj y deja que corra lo que eso destrabe. */
async function pasan(ms) {
  await asentar();
  mock.timers.tick(ms);
  await asentar();
}

const copiaDeDatos = (cuerpo, guardado) => new Response(cuerpo, { headers: { "content-type": "application/json", ...(guardado === undefined ? {} : { [GUARDADO]: String(guardado) }) } });

beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"], now: AHORA }));
afterEach(() => mock.timers.reset());

describe("vencimiento de las copias de /api", () => {
  const sw = cargar();
  const { vidaDe, vigente, nacimiento } = sw.fn;

  it("cada tipo de dato tiene su plazo; lo que no es de /api no vence", () => {
    assert.equal(vidaDe("/api/nubes"), 3 * HORA);
    assert.equal(vidaDe("/api/satelites/estacion"), 12 * HORA);
    assert.equal(vidaDe("/api/satelites/starlink"), 12 * HORA);
    assert.equal(vidaDe("/cielo"), Infinity);
    assert.equal(vidaDe("/manifest.webmanifest"), Infinity);
  });

  it("una ruta de /api sin plazo declarado vale cero: no se guarda", () => {
    assert.equal(vidaDe("/api/otra-cosa"), 0);
  });

  it("vigente hasta el plazo, vencida desde ahí", () => {
    assert.equal(vigente(String(AHORA - 3 * HORA + 1), 3 * HORA, AHORA), true);
    assert.equal(vigente(String(AHORA - 3 * HORA), 3 * HORA, AHORA), false);
    assert.equal(vigente(String(AHORA - 30 * HORA), 3 * HORA, AHORA), false);
    assert.equal(vigente(String(AHORA), 3 * HORA, AHORA), true);
  });

  it("sin fecha o con una fecha rota no se sabe cuánto tiene: vencida", () => {
    for (const rota of [null, undefined, "", "ayer", "12.5", "1e3", "NaN", "Infinity"]) assert.equal(vigente(rota, 3 * HORA, AHORA), false, String(rota));
  });

  it("con fecha del futuro (reloj atrasado a mano), vencida; un ajuste de segundos se perdona", () => {
    assert.equal(vigente(String(AHORA + 2 * HORA), 3 * HORA, AHORA), false);
    assert.equal(vigente(String(AHORA + 5_000), 3 * HORA, AHORA), true);
  });

  it("lo que no vence se sirve siempre, tenga la fecha que tenga", () => {
    for (const fecha of [null, "ayer", String(AHORA + 2 * HORA), String(AHORA - 9000 * HORA)]) assert.equal(vigente(fecha, Infinity, AHORA), true, String(fecha));
  });

  it("la fecha de una respuesta descuenta lo que llevaba en la CDN (Age, en segundos)", () => {
    assert.equal(nacimiento(AHORA, "600"), AHORA - 600_000);
    assert.equal(nacimiento(AHORA, "0"), AHORA);
    for (const sinAge of [null, "", "-5", "10 min", "1.5"]) assert.equal(nacimiento(AHORA, sinAge), AHORA, String(sinAge));
  });

  it("los plazos de la red: el de datos queda por debajo de los 8 s que espera Nubes.tsx", () => {
    assert.equal(sw.constante("PLAZO_PAGINA_MS"), 3000);
    assert.equal(sw.constante("PLAZO_DATOS_MS"), 5000);
    const nubes = readFileSync(new URL("../cuando/Nubes.tsx", import.meta.url), "utf8");
    const espera = Number(/const ESPERA_MS = ([\d_]+);/.exec(nubes)?.[1].replaceAll("_", ""));
    assert.ok(sw.constante("PLAZO_DATOS_MS") < espera, `PLAZO_DATOS_MS tiene que ser menor que ESPERA_MS de Nubes.tsx (${espera})`);
  });
});

describe("la carrera entre la red y el plazo (redOCopia)", () => {
  const { redOCopia } = cargar().fn;

  it("la red contesta a tiempo: su respuesta, sin mirar la copia", async () => {
    let buscadas = 0;
    const r = await redOCopia(Promise.resolve("red"), () => (buscadas++, "copia"), 3000);
    assert.equal(r, "red");
    assert.equal(buscadas, 0);
  });

  it("la red no contesta: la copia, justo al cumplirse el plazo", async () => {
    const r = seguir(redOCopia(COLGADA(), () => "copia", 3000));
    await pasan(2999);
    assert.equal(r.lista, false);
    await pasan(1);
    assert.equal(r.valor, "copia");
  });

  it("la red no contesta y no hay copia: se sigue esperando a la red", async () => {
    const red = diferida();
    const r = seguir(redOCopia(red.promesa, () => undefined, 3000));
    await pasan(60_000);
    assert.equal(r.lista, false);
    red.ok("red, tarde");
    await asentar();
    assert.equal(r.valor, "red, tarde");
  });

  it("la red falla antes del plazo: la copia, sin esperar al plazo", async () => {
    const r = seguir(redOCopia(CAIDA(), () => "copia", 3000));
    await asentar();
    assert.equal(r.valor, "copia");
  });

  it("la red falla y no hay copia: undefined (quien llama decide qué mostrar)", async () => {
    const antes = seguir(redOCopia(CAIDA(), () => undefined, 3000));
    await asentar();
    assert.deepEqual([antes.lista, antes.valor, antes.error], [true, undefined, undefined]);

    const red = diferida();
    const despues = seguir(redOCopia(red.promesa, () => undefined, 3000));
    await pasan(3000);
    red.mal(new TypeError("Failed to fetch"));
    await asentar();
    assert.deepEqual([despues.lista, despues.valor, despues.error], [true, undefined, undefined]);
  });

  it("si la búsqueda de la copia falla, es como no tener copia", async () => {
    const r = seguir(redOCopia(CAIDA(), () => Promise.reject(new Error("caché rota")), 3000));
    await asentar();
    assert.deepEqual([r.lista, r.valor, r.error], [true, undefined, undefined]);
  });

  it("servida la copia, que la red falle después no deja una promesa rechazada sin manejar", async () => {
    const sueltas = [];
    const anotar = (motivo) => sueltas.push(motivo);
    process.on("unhandledRejection", anotar);
    try {
      const red = diferida();
      const r = seguir(redOCopia(red.promesa, () => "copia", 3000));
      await pasan(3000);
      assert.equal(r.valor, "copia");
      red.mal(new TypeError("Failed to fetch"));
      await asentar();
      assert.deepEqual(sueltas, []);
    } finally {
      process.off("unhandledRejection", anotar);
    }
  });
});

describe("páginas con la señal colgada", () => {
  it("con copia: se sirve la copia a los 3 s, ni antes ni sin haber probado la red", async () => {
    const sw = cargar(COLGADA);
    await (await sw.cache("andino-v1-paginas")).put("/cielo", pagina("copia de /cielo"));
    const e = sw.pedir("/cielo", { navega: true });
    await pasan(2999);
    assert.deepEqual(sw.pedidos, ["/cielo"]);
    assert.equal(e.respuesta.lista, false);
    await pasan(1);
    assert.equal(await e.respuesta.valor.text(), "copia de /cielo");
  });

  it("la respuesta que llega después de servir la copia la renueva, y el service worker la espera", async () => {
    const red = diferida();
    const sw = cargar((req) => (direccion(req) === `${ORIGEN}/cielo` ? red.promesa : Promise.resolve(deLaRed("", { status: 404 }))));
    const paginas = await sw.cache("andino-v1-paginas");
    await paginas.put("/cielo", pagina("copia vieja"));
    const e = sw.pedir("/cielo", { navega: true });
    await pasan(3000);
    assert.equal(await e.respuesta.valor.text(), "copia vieja");

    const esperas = seguir(Promise.all(e.esperas));
    await asentar();
    assert.equal(e.esperas.length, 1);
    assert.equal(esperas.lista, false, "waitUntil tiene que seguir pendiente mientras la red no contestó");

    // La red contesta, pero la caché tarda en escribir: el service worker tiene que seguir despierto hasta el final.
    const escritura = diferida();
    const escribir = paginas.put.bind(paginas);
    paginas.put = (req, res) => escritura.promesa.then(() => escribir(req, res));
    red.ok(pagina("página nueva"));
    await asentar();
    assert.equal(esperas.lista, false, "waitUntil tiene que seguir pendiente hasta que la copia quede escrita");
    escritura.ok();
    await esperas.promesa;
    assert.equal(await (await paginas.match("/cielo")).text(), "página nueva");
  });

  it("si la red no contesta nunca, el service worker deja de esperarla a los 30 s", async () => {
    const sw = cargar(COLGADA);
    await (await sw.cache("andino-v1-paginas")).put("/cielo", pagina("copia"));
    const e = sw.pedir("/cielo", { navega: true });
    const esperas = seguir(Promise.all(e.esperas));
    await pasan(29_999);
    assert.equal(esperas.lista, false);
    await pasan(1);
    assert.equal(esperas.lista, true);
  });

  it("una variante con consulta que nunca se guardó usa la copia de su ruta", async () => {
    const sw = cargar(COLGADA);
    await (await sw.cache("andino-v1-paginas")).put("/cielo", pagina("copia de /cielo"));
    const e = sw.pedir("/cielo?placeId=volcan", { navega: true });
    await pasan(3000);
    assert.equal(await e.respuesta.valor.text(), "copia de /cielo");
  });

  it("sin copia: se espera a la red, y se sirve lo que conteste", async () => {
    const red = diferida();
    const sw = cargar(() => red.promesa);
    const e = sw.pedir("/explorar", { navega: true });
    await pasan(60_000);
    assert.equal(e.respuesta.lista, false);
    red.ok(deLaRed("no existe", { status: 404, tipo: "text/html" }));
    await asentar();
    assert.equal(e.respuesta.valor.status, 404);
    assert.deepEqual((await sw.cache("andino-v1-paginas")).rutas(), [], "una respuesta con error no se guarda");
  });

  it("sin copia y la red falla: la pantalla «Sin señal»", async () => {
    const sw = cargar(CAIDA);
    const e = sw.pedir("/explorar", { navega: true });
    await asentar();
    assert.equal(e.respuesta.valor.status, 503);
    assert.match(await e.respuesta.valor.text(), /Sin señal/);
  });

  it("la red contesta a tiempo: se sirve y se guarda lo de la red, no la copia", async () => {
    const sw = cargar((req) => Promise.resolve(direccion(req) === `${ORIGEN}/cielo` ? pagina("de la red") : deLaRed("", { status: 404 })));
    const paginas = await sw.cache("andino-v1-paginas");
    await paginas.put("/cielo", pagina("copia"));
    const e = sw.pedir("/cielo", { navega: true });
    await asentar();
    assert.equal(await e.respuesta.valor.text(), "de la red");
    await Promise.all(e.esperas);
    assert.equal(await (await paginas.match("/cielo")).text(), "de la red");
  });
});

describe("datos con la señal colgada o caída", () => {
  const NUBES = "/api/nubes?placeId=tilcara";

  it("copia vigente y red colgada: la copia a los 5 s", async () => {
    const sw = cargar(COLGADA);
    await (await sw.cache("andino-v1-datos")).put(NUBES, copiaDeDatos("nubes de hace una hora", AHORA - HORA));
    const e = sw.pedir(NUBES);
    await pasan(4999);
    assert.equal(e.respuesta.lista, false);
    await pasan(1);
    assert.equal(await e.respuesta.valor.text(), "nubes de hace una hora");
  });

  it("copia vigente y red caída: la copia, enseguida", async () => {
    const sw = cargar(CAIDA);
    await (await sw.cache("andino-v1-datos")).put(NUBES, copiaDeDatos("nubes de hace una hora", AHORA - HORA));
    const e = sw.pedir(NUBES);
    await asentar();
    assert.equal(await e.respuesta.valor.text(), "nubes de hace una hora");
  });

  it("copia vencida: no se sirve; con la red colgada se sigue esperando y con la red caída el pedido falla", async () => {
    const red = diferida();
    const sw = cargar(() => red.promesa);
    await (await sw.cache("andino-v1-datos")).put(NUBES, copiaDeDatos("nubes de ayer", AHORA - 4 * HORA));
    const e = sw.pedir(NUBES);
    await pasan(60_000);
    assert.equal(e.respuesta.lista, false);
    red.mal(new TypeError("Failed to fetch"));
    await asentar();
    assert.equal(e.respuesta.valor.type, "error");
  });

  it("los pasos de satélites valen 12 h: a las 11 se sirven y a las 13 no", async () => {
    const sw = cargar(CAIDA);
    const datos = await sw.cache("andino-v1-datos");
    await datos.put("/api/satelites/estacion?placeId=tilcara&fecha=2026-11-23", copiaDeDatos("pasos de hace 11 h", AHORA - 11 * HORA));
    await datos.put("/api/satelites/starlink?placeId=tilcara&fecha=2026-11-23", copiaDeDatos("pasos de hace 13 h", AHORA - 13 * HORA));
    const estacion = sw.pedir("/api/satelites/estacion?placeId=tilcara&fecha=2026-11-23");
    const starlink = sw.pedir("/api/satelites/starlink?placeId=tilcara&fecha=2026-11-23");
    await asentar();
    assert.equal(await estacion.respuesta.valor.text(), "pasos de hace 11 h");
    assert.equal(starlink.respuesta.valor.type, "error");
  });

  it("una copia sin fecha (guardada por la versión anterior) no se sirve", async () => {
    const sw = cargar(CAIDA);
    await (await sw.cache("andino-v1-datos")).put(NUBES, copiaDeDatos("nubes de quién sabe cuándo"));
    const e = sw.pedir(NUBES);
    await asentar();
    assert.equal(e.respuesta.valor.type, "error");
  });

  it("lo que llega de la red se guarda con su fecha, descontando Age, y sin tocar lo que recibe la página", async () => {
    const sw = cargar(() => Promise.resolve(deLaRed('{"porHora":[1]}', { cabeceras: { age: "600", "content-encoding": "br", "content-length": "9" } })));
    const e = sw.pedir(NUBES);
    await asentar();
    assert.equal(await e.respuesta.valor.text(), '{"porHora":[1]}');
    assert.equal(e.respuesta.valor.headers.get(GUARDADO), null);
    await Promise.all(e.esperas);
    const copia = await (await sw.cache("andino-v1-datos")).match(NUBES);
    assert.equal(copia.headers.get(GUARDADO), String(AHORA - 600_000));
    assert.equal(copia.headers.get("content-type"), "application/json");
    assert.deepEqual([copia.headers.get("content-encoding"), copia.headers.get("content-length")], [null, null]);
    assert.equal(await copia.text(), '{"porHora":[1]}');
  });

  it("la copia recién guardada se sirve cuando después la red se cae, y deja de servirse al vencer", async () => {
    const sw = cargar(() => Promise.resolve(deLaRed("nubes frescas")));
    await Promise.all(sw.pedir(NUBES).esperas);
    sw.red = CAIDA;
    await pasan(3 * HORA - 1000);
    const antes = sw.pedir(NUBES);
    await asentar();
    assert.equal(await antes.respuesta.valor.text(), "nubes frescas");
    await pasan(1000);
    const despues = sw.pedir(NUBES);
    await asentar();
    assert.equal(despues.respuesta.valor.type, "error");
  });

  it("una respuesta con error o no-store no pisa la copia", async () => {
    const sw = cargar(() => Promise.resolve(deLaRed('{"error":"sin pronóstico"}', { status: 502 })));
    const datos = await sw.cache("andino-v1-datos");
    await datos.put(NUBES, copiaDeDatos("nubes de hace una hora", AHORA - HORA));
    await Promise.all(sw.pedir(NUBES).esperas);
    sw.red = () => Promise.resolve(deLaRed("no guardar", { cabeceras: { "cache-control": "no-store" } }));
    await Promise.all(sw.pedir(NUBES).esperas);
    assert.equal(await (await datos.match(NUBES)).text(), "nubes de hace una hora");
  });

  it("una ruta de /api sin plazo declarado no se guarda ni se sirve guardada", async () => {
    const sw = cargar(() => Promise.resolve(deLaRed("dato nuevo")));
    const datos = await sw.cache("andino-v1-datos");
    const e = sw.pedir("/api/otra-cosa");
    await asentar();
    assert.equal(await e.respuesta.valor.text(), "dato nuevo");
    await Promise.all(e.esperas);
    assert.deepEqual(datos.rutas(), []);

    await datos.put("/api/otra-cosa", copiaDeDatos("guardado a mano", AHORA));
    sw.red = CAIDA;
    const sinRed = sw.pedir("/api/otra-cosa");
    await asentar();
    assert.equal(sinRed.respuesta.valor.type, "error");
  });

  it("los datos del router (?_rsc= o cabecera RSC) no vencen y usan el plazo corto, el de las páginas", async () => {
    const sw = cargar(COLGADA);
    const datos = await sw.cache("andino-v1-datos");
    await datos.put("/cielo?_rsc=abc", copiaDeDatos("datos del router, sin fecha"));
    await datos.put("/explorar", copiaDeDatos("datos del router por cabecera"));
    await datos.put("/manifest.webmanifest", copiaDeDatos("manifest"));
    const porConsulta = sw.pedir("/cielo?_rsc=abc");
    const porCabecera = sw.pedir("/explorar", { cabeceras: { RSC: "1" } });
    const manifest = sw.pedir("/manifest.webmanifest");
    await pasan(2999);
    assert.deepEqual([porConsulta.respuesta.lista, porCabecera.respuesta.lista], [false, false]);
    await pasan(1);
    assert.equal(await porConsulta.respuesta.valor.text(), "datos del router, sin fecha");
    assert.equal(await porCabecera.respuesta.valor.text(), "datos del router por cabecera");
    assert.equal(manifest.respuesta.lista, false, "lo que no es del router espera el plazo de datos");
    await pasan(2000);
    assert.equal(await manifest.respuesta.valor.text(), "manifest");
  });

  it("datos del router sin copia: se sigue esperando a la red, aunque la página de esa ruta esté guardada", async () => {
    const red = diferida();
    const sw = cargar(() => red.promesa);
    await (await sw.cache("andino-v1-paginas")).put("/cielo", pagina("copia de /cielo"));
    const e = sw.pedir("/cielo?placeId=tilcara&_rsc=nunca-pedido");
    await pasan(60_000);
    assert.equal(e.respuesta.lista, false);
    red.ok(deLaRed("datos del router", { tipo: "text/x-component" }));
    await asentar();
    assert.equal(await e.respuesta.valor.text(), "datos del router");
  });

  it("lo que no es GET, lo de otro origen, Pacha y el recordatorio pasan sin tocarse", () => {
    const sw = cargar(COLGADA);
    assert.equal(sw.pedir("/api/nubes?placeId=tilcara", { metodo: "POST" }).respuesta, null);
    assert.equal(sw.pedir("https://api.open-meteo.com/v1/forecast").respuesta, null);
    assert.equal(sw.pedir("/api/pacha/ask").respuesta, null);
    assert.equal(sw.pedir("/api/recordatorio?placeId=tilcara").respuesta, null);
    assert.equal(sw.pedir("/places/tilcara.jpg", { cabeceras: { range: "bytes=0-" } }).respuesta, null);
    assert.deepEqual(sw.pedidos, []);
  });
});

describe("fotos con la señal colgada", () => {
  const foto = (ancho) => `/_next/image?url=%2Fplaces%2Ftilcara.jpg&w=${ancho}&q=75`;

  it("falta esa medida y la red no contesta: a los 3 s sale otra medida de la misma foto", async () => {
    const sw = cargar(COLGADA);
    await (await sw.cache("andino-v1-fijos")).put(foto(750), new Response("tilcara a 750"));
    const e = sw.pedir(foto(1080));
    await pasan(2999);
    assert.equal(e.respuesta.lista, false);
    await pasan(1);
    assert.equal(await e.respuesta.valor.text(), "tilcara a 750");
  });

  it("un archivo de /_next/static/ que falta no tiene reemplazo: se espera a la red", async () => {
    const red = diferida();
    const sw = cargar(() => red.promesa);
    await (await sw.cache("andino-v1-fijos")).put("/_next/static/chunks/otro.js", new Response("otro"));
    const e = sw.pedir("/_next/static/chunks/nuevo.js");
    await pasan(60_000);
    assert.equal(e.respuesta.lista, false);
    red.ok(deLaRed("nuevo", { tipo: "application/javascript" }));
    await asentar();
    assert.equal(await e.respuesta.valor.text(), "nuevo");
    await Promise.all(e.esperas);
    assert.deepEqual((await sw.cache("andino-v1-fijos")).rutas(), ["/_next/static/chunks/otro.js", "/_next/static/chunks/nuevo.js"]);
  });

  it("lo que está guardado se sirve sin pedirle nada a la red", async () => {
    const sw = cargar(COLGADA);
    await (await sw.cache("andino-v1-fijos")).put(foto(750), new Response("tilcara a 750"));
    const e = sw.pedir(foto(750));
    await asentar();
    assert.equal(await e.respuesta.valor.text(), "tilcara a 750");
    assert.deepEqual(sw.pedidos, []);
  });
});

describe("tope de los archivos fijos", () => {
  const { sobrantes, nombradosEn } = cargar().fn;
  const nadie = () => false;
  const lista = (deSwJs) => [...deSwJs]; // lo que devuelve sw.js es de otro contexto: se copia para compararlo

  it("por debajo del tope o justo en el tope no sobra nada", () => {
    assert.deepEqual(lista(sobrantes(["a", "b", "c"], 3, nadie)), []);
    assert.deepEqual(lista(sobrantes(["a", "b", "c"], 10, nadie)), []);
  });

  it("sobran las más viejas, las primeras de la lista, y solo las necesarias para volver al tope", () => {
    assert.deepEqual(lista(sobrantes(["a", "b", "c", "d", "e"], 3, nadie)), ["a", "b"]);
  });

  it("las protegidas no se van aunque sean las más viejas: se va la siguiente", () => {
    assert.deepEqual(lista(sobrantes(["a", "b", "c", "d", "e"], 3, (d) => d === "a")), ["b", "c"]);
  });

  it("si lo protegido solo ya pasa el tope, se va todo lo demás y nada protegido", () => {
    assert.deepEqual(lista(sobrantes(["a", "b", "c", "d", "e"], 1, (d) => d !== "c")), ["c"]);
  });

  it("del HTML de una página salen sus archivos de /_next/static/ (sin el de compatibilidad) y sus fotos en cada medida", () => {
    const html = `<link rel="stylesheet" href="/_next/static/chunks/estilos.css"/><script src="/_next/static/chunks/app.js" async=""></script>
      <script src="/_next/static/chunks/viejos.js" noModule=""></script><script>self.__next_f.push([1,"[\\"/_next/static/chunks/perezoso.js\\"]"])</script>
      <img srcSet="/_next/image?url=%2Fplaces%2Ftilcara.jpg&amp;w=750&amp;q=75 750w, /_next/image?url=%2Fplaces%2Ftilcara.jpg&amp;w=1080&amp;q=75 1080w" src="/brand/andino-mark.svg"/>`;
    const { archivos, fotos } = nombradosEn(html);
    assert.deepEqual([...archivos].sort(), ["/_next/static/chunks/app.js", "/_next/static/chunks/estilos.css", "/_next/static/chunks/perezoso.js"]);
    assert.deepEqual([...fotos], ["/_next/image?url=%2Fplaces%2Ftilcara.jpg&w=750&q=75", "/_next/image?url=%2Fplaces%2Ftilcara.jpg&w=1080&q=75"]);
  });

  it("al pasar el tope se van los archivos más viejos, y nunca lo que nombra una página guardada", async () => {
    const HTML = `<script src="/_next/static/chunks/vigente.js"></script><img src="/_next/image?url=%2Fplaces%2Ftilcara.jpg&amp;w=750&amp;q=75"/>`;
    const sw = cargar((req) => Promise.resolve(["/", "/cielo", "/explorar"].includes(direccion(req).slice(ORIGEN.length)) ? pagina(HTML) : deLaRed("", { status: 404 })));
    const max = sw.constante("MAX_FIJOS");
    const fijos = await sw.cache("andino-v1-fijos");
    // Lo más viejo de todo es justo lo que la página guardada necesita; después, un despliegue tras otro.
    await fijos.put("/_next/static/chunks/vigente.js", new Response("vigente"));
    await fijos.put("/_next/image?url=%2Fplaces%2Ftilcara.jpg&w=1080&q=75", new Response("foto en otra medida"));
    for (let i = 0; i < max + 10; i++) await fijos.put(`/_next/static/chunks/viejo-${i}.js`, new Response(`viejo ${i}`));

    await sw.instalar();

    const quedan = fijos.rutas();
    assert.equal(quedan.length, max);
    assert.ok(quedan.includes("/_next/static/chunks/vigente.js"), "lo que nombra la página guardada tiene que quedar");
    assert.ok(quedan.includes("/_next/image?url=%2Fplaces%2Ftilcara.jpg&w=1080&q=75"), "una foto que la página nombra queda en cualquier medida");
    assert.ok(!quedan.includes("/_next/static/chunks/viejo-0.js") && !quedan.includes("/_next/static/chunks/viejo-11.js"), "se van los más viejos");
    assert.ok(quedan.includes("/_next/static/chunks/viejo-12.js") && quedan.includes(`/_next/static/chunks/viejo-${max + 9}.js`), "quedan los más nuevos");
  });

  it("por debajo del tope (120 entradas) no se borra nada", async () => {
    const sw = cargar(() => Promise.resolve(deLaRed("", { status: 404 })));
    assert.equal(sw.constante("MAX_FIJOS"), 120);
    const fijos = await sw.cache("andino-v1-fijos");
    for (let i = 0; i < sw.constante("MAX_FIJOS"); i++) await fijos.put(`/_next/static/chunks/viejo-${i}.js`, new Response(`viejo ${i}`));
    await sw.instalar();
    assert.equal(fijos.rutas().length, sw.constante("MAX_FIJOS"));
  });
});
