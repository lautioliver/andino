<p align="center"><img src="public/brand/andino-mark.svg" width="96" alt="ANDINO"></p>

<h1 align="center">ANDINO</h1>
<h3 align="center">Tu mejor noche de cielo en Jujuy 🌌</h3>

<p align="center">
  <a href="https://andino-neon.vercel.app"><b>🚆 Subite acá: andino-neon.vercel.app</b></a>
</p>

<p align="center">
  Hecha para la <b>Cursor Hackathon Jujuy</b>, la del <b>Tren Solar de la Quebrada</b><br>
  En español y en inglés · sin instalar nada
</p>

---

## 📣 ¡Pasajeros al andén!

La gente viene a la Quebrada, entre otras cosas, por el cielo. Y creemos que muchos se van sin verlo:

- salen la noche de **Luna llena**, que tapa casi todo;
- salen **a mala hora**, cuando todavía no terminó de oscurecer;
- miran desde el **pueblo iluminado**;
- y **no saben qué están viendo**: como mucho, las Tres Marías y la Cruz del Sur.

ANDINO viaja en el bolsillo del pasajero del Tren Solar y le dice **cuándo** salir, **adónde** apuntar el teléfono y **qué significa** lo que ve.

> Esto es una hipótesis nuestra, armada con la devolución de los mentores y lo que vimos en el tren. No tenemos cifras, así que no las inventamos.

## 🗺️ El recorrido

```text
☀️  Volcán ── Tumbaya ── Purmamarca ── Posta de Hornillos ── Maimará ── El Bayeh ── Tilcara  🌌
```

Siete paradas. En cada una, ANDINO sabe qué hay por la ventana de día y qué va a haber en el cielo esa noche.

## 🎫 Tu boleto incluye

| Vagón | Qué pasa ahí |
|---|---|
| 🌙 **Cuándo** | La noche de hoy en tu parada: a qué hora se pone el sol, cuándo queda el cielo oscuro, cómo viene la Luna y qué nubes se esperan. De las noches de tu viaje te dice cuál conviene, y con **«Avisame esta noche»** te deja un recordatorio en el calendario. |
| 📱 **Apuntá** | Levantás el teléfono y el cielo tiene nombre. En vivo con la brújula, también de día, desde tu ubicación. Con la **cámara** detrás del dibujo, **luz roja** para no perder la vista nocturna y la pantalla siempre encendida. |
| 🦙 **Qué significa** | La Yacana, la llama oscura de la Vía Láctea, con sus fuentes. Y «tu signo» como astronomía: dónde está de verdad esta noche, sin predicciones. |
| 🏔️ **Pacha** | De día, sacás una foto por la ventana y te cuenta qué lugar es, su historia y de dónde sale el dato. Después le podés repreguntar. |
| 🛰️ **Satélites** | Los pasos visibles de Starlink para tu parada y tu noche. |

## 🔭 Regla de la casa: acá no se inventa nada

- **El cielo se calcula.** Sol, Luna, planetas y estrellas salen de [astronomy-engine](https://github.com/cosinekitty/astronomy) para el lugar y la fecha. La IA no calcula nada: solo explica.
- **Los satélites también.** Órbitas públicas de CelesTrak, propagadas con satellite.js.
- **El cielo andino va con fuentes.** La Yacana es una tradición documentada en Perú y en el norte de Chile, en un cielo que también se ve desde Jujuy. No la presentamos como saber local jujeño. El detalle está en [`docs/fuentes-cielo-andino.md`](docs/fuentes-cielo-andino.md).
- **Las nubes son un pronóstico, y lo decimos.** Vienen de [Open-Meteo](https://open-meteo.com/) y pueden cambiar. El cálculo sigue sin conocer los cerros.
- **Astronomía, no astrología.**
- **ANDINO no tiene afiliación con SpaceX.**

## 🪁 Todo esto fue posible gracias a `bk`

ANDINO se armó en un día: el primer commit es del 22 de noviembre de 2026 a las 09:51, y esa misma noche ya había **más de 30 PRs mergeados y en producción**.

Detrás hay un equipo chico con la rienda y varios agentes volando a la vez. Eso es **[Barrilete Kit](https://github.com/lautioliver/barrilete-kit)**:

> **Los agentes vuelan. Vos tenés la rienda.**
> Reglas, skills, docs y ADRs para que un agente lleve una idea del plan al PR, mientras vos aprobás el plan y mergeás.

Lo que `bk` puso en este viaje:

- **Varios chats a la vez, sin chocarse.** Cada agente trabaja en su worktree y en su rama; `main` queda siempre desplegable.
- **La posta entre chats.** Cuando un chat se llena, `bk handoff` deja el resumen y el siguiente arranca desde ahí, sin perder el hilo.
- **Lecciones que se acumulan.** Cada desvío que la persona corrige se vuelve regla para los agentes que vienen después (`bk learn`).
- **Del plan al PR.** El kit trae el flujo completo: `bk plan`, `bk run`, `bk review`.

Funciona con Claude Code y con Cursor. Más en [barrilete-kit-lp.vercel.app](https://barrilete-kit-lp.vercel.app).

## 🚂 La locomotora

- **Next.js 16** (App Router), **React 19**, **TypeScript** y **Tailwind CSS 4**, desplegado en **Vercel**
- **astronomy-engine** para las efemérides y **satellite.js** para las órbitas
- **AI SDK** con Gemini 2.5 Flash para Pacha; las claves viven solo en el servidor
- **Vercel Blob** como respaldo de las órbitas
- Tests de la lógica con `node --test`

## 🛠️ Cómo subirse

```bash
npm install
npm run dev     # http://localhost:3000
npm test
npm run lint
npm run build
```

Las claves de IA van en `.env.local`, que nunca se commitea.

## 🧭 Plano del tren

```text
app/                rutas: / , /explorar , /cielo , y las de /api
features/cuando     la mejor noche
features/cielo      motor del cielo, Apuntá, cámara y Yacana
features/signo      tu signo en el cielo
features/satelites  pasos de Starlink
features/pacha      foto → lugar, con IA
shared/             contratos (types.ts), UI base e idioma (i18n/lang.ts) — coordinar antes de cambiar
data/               dataset compartido (places.ts) — coordinar antes de cambiar
docs/               plan.md, design.md y fuentes-cielo-andino.md
```

Para el detalle: [`docs/plan.md`](docs/plan.md) (plan del proyecto) y [`docs/design.md`](docs/design.md) (diseño, contratos e implementación; fuente de verdad).

## 📜 Reglas del vagón

- `main` siempre desplegable; ramas cortas y PRs chicos.
- Los cambios en `app/layout.tsx`, `app/globals.css`, `shared/`, `data/places.*` y `package.json` se coordinan antes.
- Claves de IA solo en el servidor.

## 🚉 Próximas paradas

- **Estación Espacial Internacional** y cuenta regresiva al próximo paso visible.
- **Desde dónde mirar:** un punto oscuro por parada, contado por la gente del lugar.
- Más teléfonos reales y más conversaciones con viajeros.

## 👷 La tripulación

- [`lautioliver`](https://github.com/lautioliver): todo el desarrollo desde la v4.
- [`jehp23`](https://github.com/jehp23): motor del cielo, pantalla Cielo y horas de la noche, hasta la v3.
- Y una flota de agentes con la rienda corta. 🪁

<p align="center"><b>ANDINO · Tu mejor noche de cielo en Jujuy</b></p>
