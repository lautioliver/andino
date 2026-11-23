// Service worker de ANDINO: que la app siga andando cuando el tren se queda sin señal.
// Escrito a mano y sin dependencias. Lo registra shared/ui/SinSenal.tsx, solo en producción.
//
// Qué hace con cada pedido (solo GET del mismo origen; todo lo demás pasa sin tocarse):
// - Primero la red: las páginas, los pedidos de datos del router de Next (los de ?_rsc= o cabecera RSC),
//   /api/* y lo demás. Con señal siempre se ve lo último; la copia guardada se usa solo si la red falla.
// - Primero la copia: lo que no cambia. /_next/static/ (nombres con hash; ahí están también las fuentes)
//   y las fotos de las paradas (/places/* y sus medidas de /_next/image).
// - Nunca se guarda: respuestas con error, parciales, opacas o marcadas no-store; tampoco /api/pacha/*
//   ni /api/recordatorio.
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
// una foto de /places sin cambiarle el nombre, o para liberar los archivos de despliegues viejos).
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
const ANCHO_FOTO = 750; // la medida de cada foto que se guarda al instalar: la de un teléfono de 375 px a 2x
const ESPERA_MS = 15000; // tope de cada pedido propio al guardar
const SIN_VARY = { ignoreVary: true }; // la URL ya distingue las variantes (?_rsc=, medidas de foto)

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
    else event.respondWith(primeroLaRed(event));
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

/** Guarda sin frenar la respuesta. Si no entra (cuota llena), se sigue sin copia. */
async function guardar(nombre, req, res, max) {
  try {
    const cache = await caches.open(nombre);
    await cache.put(req, res);
    if (max) await recortar(cache, max);
  } catch {}
}

/** Tope de entradas: se van las más viejas (keys() las da en el orden en que se guardaron). Las tres principales no. */
async function recortar(cache, max) {
  const claves = (await cache.keys()).filter((k) => !(k.url.slice(self.location.origin.length) in PRINCIPALES));
  for (const k of claves.slice(0, Math.max(0, claves.length - max))) await cache.delete(k);
}

// Primero la red. La copia, solo si la red falla; sin copia, el pedido falla como fallaría sin service worker
// y cada parte de la app muestra su aviso de «no disponible».
async function primeroLaRed(event) {
  try {
    const res = await fetch(event.request);
    if (guardable(res)) event.waitUntil(guardar(DATOS, event.request, res.clone(), MAX_DATOS));
    return res;
  } catch {
    return (await (await caches.open(DATOS)).match(event.request, SIN_VARY)) || Response.error();
  }
}

// Primero la copia. De una foto, sin red, sirve cualquier medida guardada: el navegador la escala.
async function primeroLaCopia(event, url) {
  const fijos = await caches.open(FIJOS);
  const copia = await fijos.match(event.request, SIN_VARY);
  if (copia) return copia;
  try {
    const res = await fetch(event.request);
    if (guardable(res)) event.waitUntil(guardar(FIJOS, event.request, res.clone()));
    return res;
  } catch {
    return (await otraMedida(fijos, fotoDe(url))) || Response.error();
  }
}

async function otraMedida(fijos, foto) {
  if (!foto) return undefined;
  const clave = (await fijos.keys()).find((k) => fotoDe(new URL(k.url)) === foto);
  return clave && fijos.match(clave, SIN_VARY);
}

// Páginas: primero la red. Sin red, la copia de esa URL; si no, la de la misma ruta sin la consulta
// (las páginas de ANDINO son estáticas: ?placeId= y compañía se leen en el teléfono); si no, «Sin señal».
async function navegar(event, url) {
  try {
    const res = await fetch(event.request);
    if (esPagina(res)) event.waitUntil(guardarPagina(event.request, url, res.clone()));
    return res;
  } catch {
    const paginas = await caches.open(PAGINAS);
    return (await paginas.match(event.request, SIN_VARY)) || (await paginas.match(url.pathname, SIN_VARY)) || sinSenal();
  }
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
 * pedir las tres pantallas; sin él, parte de las copias y solo pide a la red lo que falta. De a una corrida
 * por vez. Lo que falle se saltea: nada de esto hace caer la instalación.
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
        const html = await res.text();
        for (const [archivo] of html.matchAll(/\/_next\/static\/[^"'\\\s<>)]+/g)) archivos.add(archivo);
        // El paquete de compatibilidad para navegadores viejos (noModule) no se baja: los que tienen service worker no lo usan.
        for (const [, archivo] of html.matchAll(/<script src="([^"]+)" noModule/gi)) archivos.delete(archivo);
        for (const [foto] of html.matchAll(/\/_next\/image\?url=%2Fplaces%2F[^&"]+&(?:amp;)?w=\d+&(?:amp;)?q=\d+/g)) {
          if (foto.includes(`w=${ANCHO_FOTO}&`)) fotos.add(foto.replaceAll("&amp;", "&"));
        }
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
