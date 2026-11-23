// Service worker de ANDINO: que la app siga andando cuando el tren se queda sin señal.
// Escrito a mano y sin dependencias. Lo registra shared/ui/SinSenal.tsx, solo en producción.
//
// Qué hace con cada pedido (solo GET del mismo origen; todo lo demás pasa sin tocarse):
// - Primero la red, con plazo: las páginas, los pedidos de datos del router de Next (los de ?_rsc= o cabecera
//   RSC), /api/* y lo demás. Con señal siempre se ve lo último. La copia guardada se usa si la red falla o si no
//   contestó dentro del plazo (señal colgada: hay conexión, pero no responde); lo que la red conteste después
//   igual renueva la copia. Sin copia se sigue esperando a la red. Los plazos: PLAZO_PAGINA_MS y PLAZO_DATOS_MS.
// - Las copias de /api vencen (VENCIMIENTOS): pasado su tiempo no se sirven, y la app muestra su aviso de
//   «no disponible» en vez de un pronóstico viejo.
// - Primero la copia: lo que no cambia. /_next/static/ (nombres con hash; ahí están también las fuentes)
//   y las fotos de las paradas (/places/* y sus medidas de /_next/image). Con tope de entradas: MAX_FIJOS.
// - Nunca se guarda: respuestas con error, parciales, opacas o marcadas no-store; tampoco /api/pacha/*,
//   /api/recordatorio ni las rutas de /api que no tienen vencimiento declarado.
// - Página sin copia y sin red: la pantalla «Sin señal» del final de este archivo.
//
// INTERRUPTOR. Si el service worker da problemas: poné ACTIVO en false y desplegá. Cada teléfono, la próxima
// vez que abra la app con señal, baja este archivo (lo hace el navegador solo, entre unos segundos y un
// minuto después de cargar la página), borra sus cachés y se da de baja; desde ahí todo va directo a la
// red, como antes de que existiera.
// Para volver a prenderlo: true y desplegar.
// Funciona porque /sw.js sale de public/ con cache-control max-age=0 y se registra con updateViaCache "none":
// el navegador lo revisa contra la red en cada visita y no queda una versión vieja pegada.
// Mientras esté en false, cada carga lo registra y se vuelve a dar de baja, sin atender ningún pedido.
const ACTIVO = true;

// Subir el número tira todo lo guardado en cada teléfono y lo arma de nuevo (por ejemplo, si se reemplaza
// una foto de /places sin cambiarle el nombre). Los archivos de despliegues viejos se van solos: MAX_FIJOS.
const VERSION = "v1";

const PREFIJO = "andino-";
const PAGINAS = `${PREFIJO}${VERSION}-paginas`; // documentos HTML
const DATOS = `${PREFIJO}${VERSION}-datos`; // lo demás que va primero a la red: datos del router, /api, manifest, íconos
const FIJOS = `${PREFIJO}${VERSION}-fijos`; // lo que va primero a la copia: /_next/static/ y fotos
// Las tres pantallas del dock, con sus nombres (shared/ui/NavLinks.tsx) para la pantalla «Sin señal».
const PRINCIPALES = { "/": ["Inicio", "Home"], "/explorar": ["De día", "By day"], "/cielo": ["De noche", "At night"] };
const SIN_GUARDAR = ["/api/pacha/", "/api/recordatorio"];
const MAX_PAGINAS = 40;
const MAX_DATOS = 120;
// Tope de la caché de archivos fijos. Un teléfono usa entre 20 y 30 entradas por despliegue (unos 15 archivos de
// /_next/static/ y las fotos) y cada despliegue nuevo deja ahí las del anterior: 120 da lugar al vigente y a
// unos cuatro anteriores, para que una pestaña que quedó abierta con una versión vieja siga encontrando lo suyo.
const MAX_FIJOS = 120;
const ANCHO_FOTO = 750; // la medida de cada foto que se guarda al instalar: la de un teléfono de 375 px a 2x
const ESPERA_MS = 15000; // tope de cada pedido propio al guardar
const SIN_VARY = { ignoreVary: true }; // la URL ya distingue las variantes (?_rsc=, medidas de foto)

// PLAZOS de la red. Señal colgada: el teléfono dice que hay conexión, pero la respuesta no llega. Si la red no
// contestó en este tiempo y hay copia, se sirve la copia; el pedido sigue en marcha y, si llega, renueva la copia.
// - Páginas y datos del router: 3 s. Son lo que frena la pantalla. Una página de ANDINO es estática y sale de una
//   CDN: con una conexión nueva son unas 4 idas y vueltas (DNS, TCP, TLS y el pedido), 1,6 s con un 3G lento de
//   400 ms por vuelta. 3 s es casi el doble: pasado eso, la señal se da por colgada. Y servir la copia de más
//   cuesta poco, porque es la misma página salvo que haya habido un despliegue en el medio.
// - Datos (/api y lo demás): 5 s. No frenan la pantalla (la página ya se ve y dice «buscando…»), el servidor a
//   veces tarda de verdad (los pasos de satélites, cuando los calcula) y acá lo fresco sí puede ser distinto de
//   la copia: se espera un poco más. Tiene que quedar por debajo de los 8 s que features/cuando/Nubes.tsx espera
//   antes de darse por vencida; con un plazo mayor la copia llegaría tarde.
const PLAZO_PAGINA_MS = 3000;
const PLAZO_DATOS_MS = 5000;
// Cuánto se mantiene despierto el service worker esperando una respuesta que ya no hace falta para la pantalla,
// solo para guardarla. Pasado eso el navegador puede dormirlo: esa renovación la hará la próxima visita con señal.
const ESPERA_TARDIA_MS = 30000;

// VENCIMIENTOS de las copias de /api: cuánto valen, contado desde que la respuesta salió del servidor (si venía
// de la CDN, se le suma lo que llevaba ahí: cabecera Age). Una copia más vieja no se sirve: mostrar como vigente
// un pronóstico vencido es engañar, y cada parte de la app ya sabe decir que no tiene el dato. Lo que no es de
// /api (páginas, datos del router, manifest, íconos) es la app misma y no vence.
// - /api/nubes: 3 h. El servidor le vuelve a pedir el pronóstico a Open-Meteo cada hora y deja de servir el suyo
//   a las 3 h (`revalidate` y `expire` en features/cuando/pronostico.ts): acá, la misma regla.
// - /api/satelites/: 12 h. El servidor vuelve a bajar las órbitas cada 3 h y las da por buenas hasta 72 h
//   (features/satelites/respaldo.ts); medio día queda bien adentro de eso. Alcanza para mirar los pasos a la tarde
//   con wifi y salir de noche sin señal; lo que se miró a la mañana ya no se muestra a la noche.
// - Una ruta de /api que no está en la lista no se guarda: antes de servir guardado un dato nuevo, alguien tiene
//   que decidir acá cuánto vale.
const HORA_MS = 3600000;
const VENCIMIENTOS = [
  ["/api/nubes", 3 * HORA_MS],
  ["/api/satelites/", 12 * HORA_MS],
];
const GUARDADO = "x-andino-guardado"; // cabecera de la copia: cuándo salió del servidor, en ms
const MARGEN_RELOJ_MS = 60000; // lo que se le perdona al reloj del teléfono si se corrige hacia atrás

if (!ACTIVO) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(borrarCaches(() => true).then(() => self.registration.unregister())));
} else {
  self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(precargar(true));
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(borrarCaches((nombre) => ![PAGINAS, DATOS, FIJOS].includes(nombre)).then(() => self.clients.claim()));
  });
  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET" || req.headers.has("range")) return;
    if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
    const navega = req.mode === "navigate";
    if (SIN_GUARDAR.some((ruta) => url.pathname.startsWith(ruta))) {
      // Sin copia, nunca. Si era un enlace (el recordatorio) y no hay red, al menos no queda el error del navegador.
      if (navega) event.respondWith(fetch(req).catch(() => sinSenal()));
      return;
    }
    if (navega) event.respondWith(navegar(event, url));
    else if (url.pathname.startsWith("/_next/static/") || fotoDe(url)) event.respondWith(primeroLaCopia(event, url));
    else event.respondWith(primeroLaRed(event, url));
  });
}

async function borrarCaches(sobra) {
  const nombres = (await caches.keys()).filter((n) => n.startsWith(PREFIJO) && sobra(n));
  await Promise.all(nombres.map((n) => caches.delete(n)));
}

/** Solo se guardan respuestas completas, sin error y del mismo origen, y nunca las que piden no guardarse. */
function guardable(res) {
  return res.status === 200 && res.type === "basic" && !/no-store/i.test(res.headers.get("cache-control") || "");
}

/** Una página guardable: HTML y sin redirección de por medio (una respuesta redirigida no sirve para una navegación). */
function esPagina(res) {
  return guardable(res) && !res.redirected && (res.headers.get("content-type") || "").includes("text/html");
}

/** La foto de una parada que pide esta URL (/places/x.jpg o /_next/image?url=/places/x.jpg), o null. */
function fotoDe(url) {
  const ruta = url.pathname === "/_next/image" ? url.searchParams.get("url") || "" : url.pathname;
  return ruta.startsWith("/places/") ? ruta : null;
}

const etag = (res) => (res.headers.get("etag") || "").replace(/^W\//, "");

/** Guarda sin frenar la respuesta (`res` puede ser una promesa). Si no entra (cuota llena), se sigue sin copia. */
async function guardar(nombre, req, res, max) {
  try {
    const lista = await res;
    const cache = await caches.open(nombre);
    await cache.put(req, lista);
    if (max) await recortar(cache, max);
  } catch {}
}

/** Tope de entradas: se van las más viejas (keys() las da en el orden en que se guardaron). Las tres principales no. */
async function recortar(cache, max) {
  const claves = (await cache.keys()).filter((k) => !(k.url.slice(self.location.origin.length) in PRINCIPALES));
  for (const k of claves.slice(0, Math.max(0, claves.length - max))) await cache.delete(k);
}

/** Cuánto vale la copia de esta ruta, en ms: Infinity si no vence (no es de /api) y 0 si no se guarda. */
function vidaDe(ruta) {
  if (!ruta.startsWith("/api/")) return Infinity;
  const regla = VENCIMIENTOS.find(([prefijo]) => ruta.startsWith(prefijo));
  return regla ? regla[1] : 0;
}

/**
 * ¿Se puede servir todavía una copia? `guardado` es el texto de su cabecera GUARDADO. Sin fecha (las copias de
 * antes de que hubiera vencimientos; Number(null) es 0 y la edad da enorme), con una fecha rota o con una fecha
 * del futuro (alguien atrasó el reloj del teléfono), no: no se sabe cuánto tiene. Lo que no vence, siempre.
 */
function vigente(guardado, vidaMs, ahoraMs) {
  const edad = ahoraMs - Number(guardado);
  return vidaMs === Infinity || (edad > -MARGEN_RELOJ_MS && edad < vidaMs);
}

/** Cuándo salió del servidor una respuesta que llega ahora: si la tenía la CDN, Age dice hace cuántos segundos. */
function nacimiento(ahoraMs, age) {
  return ahoraMs - (/^\d+$/.test(age || "") ? Number(age) * 1000 : 0);
}

/**
 * La misma respuesta con esa fecha anotada en la cabecera GUARDADO, para guardarla. Lee el cuerpo entero (son
 * respuestas de /api, chicas), que ya llega descomprimido: las cabeceras que hablan del cuerpo comprimido se van.
 */
async function conFecha(res, cuando) {
  const cabeceras = new Headers(res.headers);
  cabeceras.set(GUARDADO, String(cuando));
  cabeceras.delete("content-encoding");
  cabeceras.delete("content-length");
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: cabeceras });
}

const SIN_RESPUESTA = {}; // marca: pasó el plazo y la red todavía no contestó

/**
 * La carrera entre la red y el plazo. `red` es la promesa de la respuesta de la red; `buscarCopia` devuelve la
 * copia guardada o undefined.
 * - La red contesta dentro del plazo: su respuesta.
 * - Pasa el plazo sin respuesta: la copia, y `red` sigue en marcha (pedirYGuardar guarda lo que llegue). Sin
 *   copia se sigue esperando a la red.
 * - La red falla, antes o después del plazo: la copia, o undefined si no hay.
 */
async function redOCopia(red, buscarCopia, plazoMs) {
  const copia = () => Promise.resolve().then(buscarCopia).catch(() => undefined);
  let reloj;
  const plazo = new Promise((ok) => (reloj = setTimeout(ok, plazoMs, SIN_RESPUESTA)));
  try {
    const primero = await Promise.race([red, plazo]);
    if (primero !== SIN_RESPUESTA) return primero;
    return (await copia()) || (await red);
  } catch {
    return copia();
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Pide a la red y guarda lo que llegue con `guardarla`, que clona la respuesta antes de que nadie la lea. El
 * service worker sigue despierto hasta que la copia quede escrita, también cuando la respuesta llega después de
 * haber servido la copia; si la red no contesta, hasta ESPERA_TARDIA_MS.
 */
function pedirYGuardar(event, guardarla) {
  let guardando;
  const red = fetch(event.request).then((res) => {
    guardando = guardarla(res);
    return res;
  });
  let reloj;
  const tope = new Promise((ok) => (reloj = setTimeout(ok, ESPERA_TARDIA_MS)));
  event.waitUntil(
    Promise.race([red, tope])
      .then(() => guardando)
      .catch(() => {})
      .finally(() => clearTimeout(reloj)),
  );
  return red;
}

// Primero la red, con plazo. La copia, si la red falla o no contesta a tiempo. Sin copia, o con la copia vencida,
// el pedido falla como fallaría sin service worker y cada parte de la app muestra su aviso de «no disponible».
function primeroLaRed(event, url) {
  const vida = vidaDe(url.pathname);
  const red = pedirYGuardar(event, (res) => {
    if (vida === 0 || !guardable(res)) return undefined;
    const copia = res.clone();
    const conSuFecha = vida === Infinity ? copia : conFecha(copia, nacimiento(Date.now(), res.headers.get("age")));
    return guardar(DATOS, event.request, conSuFecha, MAX_DATOS);
  });
  const copia = async () => {
    const guardada = await (await caches.open(DATOS)).match(event.request, SIN_VARY);
    return guardada && vigente(guardada.headers.get(GUARDADO), vida, Date.now()) ? guardada : undefined;
  };
  const delRouter = event.request.headers.has("rsc") || url.searchParams.has("_rsc");
  return redOCopia(red, copia, delRouter ? PLAZO_PAGINA_MS : PLAZO_DATOS_MS).then((res) => res || Response.error());
}

// Primero la copia; si falta, la red. De una foto sirve cualquier medida guardada (el navegador la escala) cuando
// la red falla o no contesta a tiempo: es la misma foto, así que el plazo es el corto.
async function primeroLaCopia(event, url) {
  const fijos = await caches.open(FIJOS);
  const copia = await fijos.match(event.request, SIN_VARY);
  if (copia) return copia;
  const red = pedirYGuardar(event, (res) => (guardable(res) ? guardar(FIJOS, event.request, res.clone()) : undefined));
  return (await redOCopia(red, () => otraMedida(fijos, fotoDe(url)), PLAZO_PAGINA_MS)) || Response.error();
}

async function otraMedida(fijos, foto) {
  if (!foto) return undefined;
  const clave = (await fijos.keys()).find((k) => fotoDe(new URL(k.url)) === foto);
  return clave && fijos.match(clave, SIN_VARY);
}

// Páginas: primero la red, con plazo. Si falla o no contesta a tiempo, la copia de esa URL; si no, la de la misma
// ruta sin la consulta (las páginas de ANDINO son estáticas: ?placeId= y compañía se leen en el teléfono). Sin
// ninguna copia se espera a la red y, si falla, «Sin señal».
function navegar(event, url) {
  const red = pedirYGuardar(event, (res) => (esPagina(res) ? guardarPagina(event.request, url, res.clone()) : undefined));
  const copia = async () => {
    const paginas = await caches.open(PAGINAS);
    return (await paginas.match(event.request, SIN_VARY)) || (await paginas.match(url.pathname, SIN_VARY));
  };
  return redOCopia(red, copia, PLAZO_PAGINA_MS).then((res) => res || sinSenal());
}

async function guardarPagina(req, url, res) {
  try {
    const paginas = await caches.open(PAGINAS);
    const previa = await paginas.match(url.pathname, SIN_VARY);
    const hayDespliegueNuevo = previa !== undefined && etag(previa) !== etag(res);
    await paginas.put(req, res);
    // Cada página que llega de la red es señal de que hay conexión: se completa lo que falte guardar (una
    // instalación con poca señal puede quedar a medias). Si la copia de esta ruta era de otro despliegue, se
    // renuevan las tres pantallas y se van las variantes con consulta del anterior (sin red las cubre la
    // copia nueva de su ruta).
    await precargar(hayDespliegueNuevo);
    if (hayDespliegueNuevo) {
      for (const k of await paginas.keys()) if (new URL(k.url).search && k.url !== req.url) await paginas.delete(k);
    }
    await recortar(paginas, MAX_PAGINAS);
  } catch {}
}

/** Un pedido propio con tope: una señal colgada no deja la instalación esperando para siempre. */
function traer(ruta, opciones) {
  return fetch(ruta, { ...opciones, ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(ESPERA_MS) } : {}) });
}

let cola = Promise.resolve();
/**
 * Guarda las tres pantallas principales y lo que necesitan para abrir sin red: los archivos de /_next/static/
 * que nombra su HTML (la primera visita los bajó antes de que existiera este service worker) y una medida de
 * cada foto de parada de la portada. Con `renovar` (al instalar y cuando aparece un despliegue nuevo) vuelve a
 * pedir las tres pantallas; sin él, parte de las copias y solo pide a la red lo que falta. Al final recorta los
 * archivos fijos al tope. De a una corrida por vez. Lo que falle se saltea: nada de esto hace caer la instalación.
 */
function precargar(renovar) {
  cola = cola.then(() => precargarTodo(renovar)).catch(() => {});
  return cola;
}

async function precargarTodo(renovar) {
  const paginas = await caches.open(PAGINAS);
  const fijos = await caches.open(FIJOS);
  const archivos = new Set();
  const fotos = new Set();
  await Promise.all(
    Object.keys(PRINCIPALES).map(async (ruta) => {
      try {
        let res = renovar ? undefined : await paginas.match(ruta, SIN_VARY);
        if (!res) {
          res = await traer(ruta, { cache: "no-cache" });
          if (!esPagina(res)) return;
          await paginas.put(ruta, res.clone());
        }
        const nombrados = nombradosEn(await res.text());
        for (const archivo of nombrados.archivos) archivos.add(archivo);
        for (const foto of nombrados.fotos) if (foto.includes(`w=${ANCHO_FOTO}&`)) fotos.add(foto);
      } catch {}
    }),
  );
  await Promise.all(
    [...archivos, ...fotos].map(async (ruta) => {
      try {
        const url = new URL(ruta, self.location.origin);
        if ((await fijos.match(url, SIN_VARY)) || (await otraMedida(fijos, fotoDe(url)))) return;
        const res = await traer(url);
        if (guardable(res)) await fijos.put(url, res);
      } catch {}
    }),
  );
  await recortarFijos(paginas, fijos);
}

/**
 * Lo que nombra el HTML de una página: sus archivos de /_next/static/ y las fotos de paradas, cada una en todas
 * las medidas de su srcset.
 */
function nombradosEn(html) {
  const archivos = new Set();
  for (const [archivo] of html.matchAll(/\/_next\/static\/[^"'\\\s<>)]+/g)) archivos.add(archivo);
  // El paquete de compatibilidad para navegadores viejos (noModule) no cuenta: los que tienen service worker no lo usan.
  for (const [, archivo] of html.matchAll(/<script src="([^"]+)" noModule/gi)) archivos.delete(archivo);
  const fotos = new Set();
  for (const [foto] of html.matchAll(/\/_next\/image\?url=%2Fplaces%2F[^&"]+&(?:amp;)?w=\d+&(?:amp;)?q=\d+/g)) {
    fotos.add(foto.replaceAll("&amp;", "&"));
  }
  return { archivos, fotos };
}

/**
 * Qué entradas sobran para volver al tope: las más viejas primero (`direcciones` viene en el orden en que se
 * guardaron), salteando las protegidas. Si lo protegido solo ya pasa el tope, sobra todo lo demás y nada más.
 */
function sobrantes(direcciones, max, protegida) {
  const sobran = [];
  for (const direccion of direcciones) {
    if (direcciones.length - sobran.length <= max) break;
    if (!protegida(direccion)) sobran.push(direccion);
  }
  return sobran;
}

/**
 * Tope de los archivos fijos: cuando pasan de MAX_FIJOS se van los más viejos (keys() los da en el orden en que
 * se guardaron), que son los de despliegues anteriores. Nunca lo que nombra el HTML de una página guardada, en
 * cualquier medida si es una foto: eso es lo que hace falta para abrirla sin red.
 */
async function recortarFijos(paginas, fijos) {
  try {
    const claves = await fijos.keys();
    if (claves.length <= MAX_FIJOS) return;
    const archivos = new Set();
    const fotos = new Set();
    for (const clave of await paginas.keys()) {
      const pagina = await paginas.match(clave, SIN_VARY);
      if (!pagina) continue;
      const nombrados = nombradosEn(await pagina.text());
      for (const archivo of nombrados.archivos) archivos.add(archivo);
      for (const foto of nombrados.fotos) fotos.add(fotoDe(new URL(foto, self.location.origin)));
    }
    const protegida = (direccion) => {
      const url = new URL(direccion);
      return archivos.has(url.pathname + url.search) || fotos.has(fotoDe(url));
    };
    for (const sobra of sobrantes(claves.map((clave) => clave.url), MAX_FIJOS, protegida)) await fijos.delete(sobra, SIN_VARY);
  } catch {}
}

// «Sin señal»: lo que se ve al abrir una página que no está guardada cuando no hay red. En los dos idiomas
// (acá no se sabe cuál eligió la persona), con enlaces a las pantallas que sí están guardadas.
async function sinSenal() {
  const paginas = await caches.open(PAGINAS);
  let enlaces = "";
  for (const [ruta, [es, en]] of Object.entries(PRINCIPALES)) {
    if (await paginas.match(ruta, SIN_VARY)) enlaces += `<li><a href="${ruta}">${es} <span lang="en">· ${en}</span></a></li>`;
  }
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#fffaf7">
<title>Sin señal · ANDINO</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #fffaf7; color: #0f172a; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  main { box-sizing: border-box; width: 100%; max-width: 26rem; padding: 2rem 1.25rem; }
  .marca { margin: 0 0 1.5rem; font-size: .75rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #475569; }
  h1 { margin: 0; font-size: 2.5rem; line-height: 1.05; letter-spacing: -.03em; }
  h1 span { display: block; margin-top: .25rem; font-size: 1.25rem; letter-spacing: -.02em; color: #475569; }
  p { margin: 1rem 0 0; color: #475569; }
  ul { margin: 1.5rem 0 0; padding: 0; list-style: none; display: grid; gap: .5rem; }
  li a { display: flex; align-items: center; min-height: 3rem; padding: 0 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: #0f172a; font-weight: 600; text-decoration: none; }
  li a span { margin-left: .35rem; font-weight: 400; color: #475569; }
  .otra { display: inline-flex; align-items: center; min-height: 2.75rem; margin-top: 1rem; color: #6246ea; font-weight: 600; }
  a:focus-visible { outline: 2px solid #7b61ff; outline-offset: 2px; }
  /* La luz roja de la app (app/globals.css): si estaba encendida, esta pantalla tampoco encandila.
     En rojo los grises y el violeta pierden contraste: todo el texto pasa a Noche. */
  html[data-luz="roja"] body::after { content: ""; position: fixed; inset: 0; height: 100lvh; background: #f00; mix-blend-mode: multiply; pointer-events: none; }
  html[data-luz="roja"] :is(p, span, a) { color: #0f172a; }
</style>
<script>try{if(localStorage.getItem("andino:luz-roja")==="1")document.documentElement.dataset.luz="roja"}catch(e){}</script>
</head>
<body>
<main>
  <p class="marca">Andino</p>
  <h1>Sin señal <span lang="en">No signal</span></h1>
  <p>Esta página no quedó guardada en el teléfono y ahora no hay conexión.${enlaces ? " Estas pantallas sí están guardadas:" : " Probá de nuevo cuando vuelva la señal."}</p>
  <p lang="en">This page wasn’t saved on your phone and there’s no connection right now.${enlaces ? " These screens are saved:" : " Try again when the signal is back."}</p>
  ${enlaces ? `<ul>${enlaces}</ul>` : ""}
  <a class="otra" href="">Reintentar <span lang="en">&nbsp;· Try again</span></a>
</main>
</body>
</html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
