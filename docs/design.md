# ANDINO — Design System & UX Specification

> Versión 4 · 22 de noviembre de 2026  
> Documento único de diseño e implementación · Complemento de [`plan.md`](./plan.md) · **Alcance: MVP de hackathon**  
> Equipo: `lautioliver` (ficha del lugar e integración) · `jehp23` (motor del cielo y demo)

> **v4:** el producto gira a astroturismo («Tu mejor noche de cielo en Jujuy»; ver `plan.md`, secciones 1 a 5). Este documento se ajustó donde contradecía esa dirección. Los anexos de implementación al final reflejan el reparto de la v3; el reparto de «Cuándo», «Apuntá» y «Qué significa» está pendiente de acordar con `jehp23`.


> **Fuente de verdad:** este archivo integra el sistema visual y las instrucciones de implementación para ambos desarrolladores. Los archivos `implementer*.md` anteriores quedan como referencias históricas; ante discrepancias prevalece este documento.

## 1. Concepto de diseño

**ANDINO — Tu mejor noche de cielo en Jujuy.**

**Dirección creativa: revista de cielo andino, editorial y sobria.** El cielo de Jujuy es el protagonista; el paisaje es el lugar desde donde se lo mira. Los datos calculados (Sol, Luna, estrellas, satélites) se presentan como información útil para salir a observar, no como decoración espacial. Evitar el cliché de una interfaz de nave espacial, el exceso de neón, la estética esotérica y la apropiación de símbolos culturales sin contexto.

**Tres principios:**
1. **Una respuesta clara primero:** cuál es la mejor noche y a qué hora salir, en la primera pantalla del lugar.
2. **Un lugar, de día y de noche:** todo gira alrededor de un punto de observación concreto.
3. **Confianza:** separar cálculos astronómicos, contenido curado con fuentes (incluido el cielo andino) y respuestas generadas por IA. Astronomía, nunca astrología: «tu signo» muestra posiciones reales, sin predicciones.

**Usuario del MVP:** el viajero de la Quebrada y la Puna que viene a vivir el cielo, incluido el perfil espiritual o alternativo. Clientes posibles (hospedajes, operadores, turismo provincial) no confirmados; no diseñar paneles para ellos durante el hackathon.

## 2. Identidad visual

### Paleta (tokens)

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0B1020` | Fondo general, modo noche |
| `--surface` | `#172033` | Tarjetas, paneles |
| `--surface-raised` | `#223047` | Elementos elevados |
| `--text` | `#F5F3EE` | Texto principal |
| `--text-muted` | `#B9C3D2` | Texto secundario |
| `--earth` | `#E8794E` | CTA de día (ficha del lugar), acentos terrestres |
| `--sky` | `#78C8E8` | Cielo, astronomía, indicadores |
| `--sand` | `#E7C99C` | Detalles cálidos, chips |
| `--success` | `#7CC9A7` | Estados confirmados |
| `--danger` | `#F29A9A` | Errores |
| `--border` | `#35435A` | Divisores y bordes |

**Reglas:** usar `--earth` como acento de día (ficha del lugar) y `--sky` de noche (cielo); **sin neones, brillos, resplandores ni degradados metálicos**. Preferir superficies planas, contornos discretos y fotografías auténticas. No codificar información solo por color. Comprobar contraste WCAG AA, especialmente en texto pequeño y botones con fondos de acento. Si un par no alcanza contraste, usar texto oscuro o ajustar el tono.

### Tipografía

- **Títulos:** Space Grotesk (fallback: sans-serif).
- **Cuerpo y controles:** Inter (fallback: system-ui).
- **Escala móvil:** hero 36/40, H1 28/34, H2 22/28, H3 18/24, cuerpo 16/24, auxiliar 14/20, etiquetas 12/16 (no para contenido esencial).
- Máximo dos familias; cargar fuentes con `font-display: swap` y fallback local.

### Espaciado, formas y profundidad

- Escala: `4, 8, 12, 16, 24, 32, 48, 64px`.
- Radios: controles `12px`, tarjetas `20px`, panel hero `28px`, pills `999px`.
- Botones táctiles: mínimo `44×44px`, preferentemente `48px` de alto.
- Sombras casi imperceptibles; bordes de 1px. **Evitar glassmorphism, glow y gradientes saturados**. La estética debe sentirse editorial, no como un template de IA.
- Íconos de trazo uniforme (p. ej., Lucide); no mezclar estilos.

### Fotografía y recursos

- Paisajes reales y reconocibles de Jujuy, con atribución y derechos de uso verificados.
- Fotografía hero 16:9 o 4:5 según pantalla; overlay oscuro para legibilidad.
- Mapas estelares calculados: distinguir visualización ilustrativa de observación real.
- Motivos culturales: no utilizar iconografía ceremonial o patrones de comunidades sin investigación y autorización pertinente.

## 3. Estructura de navegación (MVP)

```text
ANDINO
├── Inicio (/)
├── Ficha del punto de observación (/explorar, «De día»)
│   ├── Elegir lugar o reconocerlo por foto
│   ├── Datos para observar + fuentes
│   └── Cuándo: la mejor noche del viaje
└── Cielo (/cielo, «De noche»)
    ├── Apuntá: brújula o girar con el dedo
    └── Qué significa: constelaciones, cielo andino, tu signo
```

Las rutas actuales (`/`, `/explorar`, `/cielo`) se mantienen; si «Cuándo» o «Qué significa» necesitan pantalla propia, se acuerda con `jehp23` antes de crear rutas.

**Navegación móvil del MVP:** `Inicio`, `De día`, `De noche`; marca ANDINO arriba. **Desktop:** navegación superior equivalente. No mostrar opciones vacías: un paso que no funciona en el teléfono real no aparece en la navegación.

**Contexto compartido:** `location`, `placeId?`, `datetime` y, para «Cuándo», las noches del viaje. Al pasar de la ficha al cielo, conservar lugar y la noche recomendada. Si no hay permiso GPS, seleccionar lugar manualmente.

## 4. Pantallas y estados

### 4.1 Inicio

**Objetivo:** que el visitante entienda el producto y empiece en menos de 10 segundos.

- Marca ANDINO y claim «Tu mejor noche de cielo en Jujuy».
- Imagen principal del cielo sobre el paisaje jujeño.
- Un solo CTA primario `Elegí un lugar` → `/explorar`. El cielo se alcanza desde el lugar (y desde la navegación), no como segundo producto.
- Recorrido en tres pasos (**Cuándo** salir → **Apuntá** el celular → **Qué significa** lo que ves); no introducir un onboarding largo.
- Cada destino muestra una línea calculada de su noche («Esta noche: Luna llena, Saturno y Sirio»).

### 4.2 Ficha del punto de observación — entrada

Lo que antes era Pacha: ya no es un producto aparte, es la forma de llegar a la ficha de un lugar.

- Título: «¿Desde dónde vas a mirar?».
- Elegir un lugar de la lista, o `Tomar una foto` / `Subir imagen` para reconocerlo.
- Acceso a imágenes de demostración identificadas como tales.
- Solicitar permisos solo al usar la función correspondiente.
- Validar formato y tamaño antes del envío; informar errores con acciones recuperables.
- Si la IA no puede identificar con confianza: «No puedo reconocerlo con seguridad» y selector de destino.

### 4.3 Ficha del punto de observación

- Foto, nombre del lugar (sugerido si viene de la IA) y opción `No es este lugar` si hay ambigüedad.
- **Cuándo**, arriba de todo: la mejor noche entre las del viaje y la franja más oscura, con el porqué en una línea (Luna, fin del crepúsculo). Hoy existe «Esta noche en {lugar}» (puesta del sol, fase de la Luna, objetos sobre el horizonte, pasos de Starlink): es la base de este bloque.
- **Para observar:** horizonte despejado o con cerros, luz cercana, cómo llegar, cuidados (altura, frío). Solo datos con fuente; si no hay dato, se dice.
- Explicación breve del lugar (2–4 frases), `Conocer más` y fuentes visibles.
- Campo `Preguntá sobre este lugar…` con pregunta de seguimiento.
- Advertencia: el cálculo no conoce nubes ni cerros cercanos. Sin datos meteorológicos no se promete cielo despejado.
- CTA `Mirar el cielo de esa noche` → `/cielo?placeId=…&fecha=…&hora=…`.

### 4.4 Cielo — Apuntá y Qué significa

- Encabezado: «El cielo desde [lugar]».
- Selector de lugar, fecha y hora; valor inicial: la noche recomendada, o una de ejemplo claramente etiquetada.
- **Apuntá:** con permiso de orientación, el cielo sigue al celular (brújula y giroscopio). **Plan B siempre disponible:** girar el cielo con el dedo. Si la brújula no es confiable en el dispositivo, se muestra solo el plan B; nunca se simula orientación. Funciona también de día (dónde está la Luna, por dónde saldrá una constelación).
- **Qué significa**, al tocar un objeto o figura: nombre, tipo, posición, explicación y fuente.
  - Constelaciones occidentales principales visibles.
  - **Cielo andino:** constelaciones oscuras de la Vía Láctea (por ejemplo la Yacana), con autor y obra de la fuente ([`fuentes-cielo-andino.md`](./fuentes-cielo-andino.md)) y dónde está documentada: Perú y norte de Chile, no Jujuy. Visualmente distintas de las occidentales; nunca una encima de la otra como si fueran equivalentes.
  - **Tu signo en el cielo:** el usuario elige su signo y se resalta la constelación en su posición real esa noche, con la diferencia respecto de las fechas del horóscopo. Sin predicciones ni lenguaje esotérico.
- Indicador «Posiciones calculadas para la fecha y hora seleccionadas»; **no** prometer visibilidad real si no se consideran clima, obstáculos y contaminación lumínica.
- CTA `Volver al lugar` conservando el lugar.

### 4.5 Estados comunes

| Estado | Tratamiento |
|---|---|
| Cargando | Skeleton o indicador con texto («Analizando imagen…»); nunca spinner infinito |
| Sin red | Mensaje claro + acceso a demo precargada, sin simular una consulta en vivo |
| Error IA | Explicar fallo y permitir reintento o selección manual |
| Lugar ambiguo | Mostrar incertidumbre y pedir confirmación |
| Sin permiso | Permitir carga de archivo o selección manual |
| Sin resultados astronómicos | Explicar selección y ofrecer otra hora/lugar |
| Demo | Badge textual discreto `Ejemplo precargado` |

## 5. Componentes reutilizables

| Componente | Propósito | Responsable inicial |
|---|---|---|
| `AppShell` | Header, navegación, contenedor | `lautioliver` |
| `Button` / `IconButton` | Acciones accesibles | `lautioliver` |
| `PlaceCard` | Punto de observación | `lautioliver` |
| `ImageUploader` | Cámara / archivo / preview | `lautioliver` |
| `SourceList` | Referencias del contenido | `lautioliver` |
| `LocationSelector` | Lugar compartido | Definición conjunta; implementación `jehp23` |
| `DateTimePicker` | Fecha y hora del cielo | `jehp23` |
| `SkyMap` | Mapa celeste 2D | `jehp23` |
| `CelestialObjectCard` | Detalle astronómico | `jehp23` |
| `StatusMessage` | Vacío, error, offline | `lautioliver` |
| `MejorNoche` | Cuándo: noches del viaje → recomendada y franja oscura | A acordar con `jehp23` |
| `Orientacion` | Apuntá: brújula con plan B de arrastre | A acordar con `jehp23` |
| `FiguraAndina` / `TuSigno` | Qué significa: cielo andino y signo en su posición real | A acordar con `jehp23` |

**Regla de colaboración:** acordar los contratos de componentes compartidos en los primeros 30 minutos. No modificar archivos compartidos en paralelo sin avisar.

## 6. Tokens CSS iniciales

```css
:root {
  color-scheme: dark;
  --bg: #0b1020;
  --surface: #172033;
  --surface-raised: #223047;
  --text: #f5f3ee;
  --text-muted: #b9c3d2;
  --earth: #e8794e;
  --sky: #78c8e8;
  --sand: #e7c99c;
  --success: #7cc9a7;
  --danger: #f29a9a;
  --border: #35435a;
  --radius-control: 12px;
  --radius-card: 20px;
  --radius-hero: 28px;
}
```

## 7. Movimiento y transición Tierra → Cielo

**Momento distintivo de la demo:** desde la ficha del lugar, el bloque «Cuándo» y su CTA abren el cielo de la noche recomendada con el mismo lugar seleccionado. Aplicar transición corta (200–350ms) entre acentos terracota y celeste; un pequeño cambio de gradiente es suficiente.

- Usar animaciones de `transform` y `opacity`, evitando efectos pesados.
- Respetar `prefers-reduced-motion`.
- La vista orbital de la Tierra es **P2**; no debe bloquear la demo ni depender de streaming 3D.
- No utilizar marcas, logos ni elementos que sugieran afiliación oficial con SpaceX.

## 8. Responsive, accesibilidad y rendimiento

- **Mobile-first:** ancho de referencia 390px; probar 320px, 390px, 768px y desktop.
- Área de contenido: `max-width: 1120px`; lectura de texto largo limitada a ~65 caracteres por línea.
- Safe areas en iOS/Android para navegación fija.
- Foco visible, navegación por teclado, etiquetas para inputs y textos alternativos.
- No depender de gestos, movimiento o audio como único modo de uso: «Apuntá» siempre tiene el plan B de arrastre y, por teclado, flechas para girar.
- Optimizar fotografías; lazy load fuera de pantalla; evitar librerías 3D grandes.
- Cargar rápido en conectividad variable y disponer de imágenes/escenarios precargados para demo.

## 9. Copywriting y tono

**Voz:** cercana, curiosa, informativa, precisa. Español rioplatense neutro con voseo consistente. Evitar promesas absolutas, exotización de comunidades y lenguaje esotérico. Decir «astronomía» o «astroturismo», nunca «astrología».

| Contexto | Texto recomendado |
|---|---|
| Inicio | «Tu mejor noche de cielo en Jujuy.» |
| Ficha | «¿Desde dónde vas a mirar?» |
| Cámara | «Tomar una foto» |
| IA | «Estamos buscando información sobre este paisaje…» |
| Incertidumbre | «No podemos identificar el lugar con seguridad. Elegí uno para continuar.» |
| Cuándo | «La mejor noche de tu viaje» |
| Apuntá | «Apuntá el celular al cielo» · plan B: «Mové el cielo con el dedo» |
| Qué significa | «Qué estás viendo» |
| Tu signo | «Dónde está tu signo esta noche» |
| Simulación | «Posiciones calculadas para la fecha y hora seleccionadas.» |
| Sin clima | «El cálculo no conoce las nubes: mirá el pronóstico antes de salir.» |
| Error | «No pudimos completar la consulta. Probá otra vez.» |

## 10. Entregables de diseño para la hackathon

### P0 — Debe estar implementado

- [ ] Paleta, tipografías y componentes base consistentes.
- [ ] Inicio con el claim y acceso al lugar en un toque.
- [ ] Ficha del punto de observación con datos para observar y fuentes.
- [ ] Cuándo: mejor noche del viaje y franja oscura, calculadas.
- [ ] Qué significa: constelaciones, una figura andina con fuente y tu signo en su posición real.
- [ ] Paso ficha → cielo conservando lugar y noche.
- [ ] Estados de carga, error, incertidumbre y demo.
- [ ] Responsive móvil real y navegación accesible.

### P0/P1 — Si funciona en el teléfono real

- [ ] Apuntá con brújula (el plan B con el dedo es P0).

### P1 — Solo si P0 está estable

- [ ] Reconocimiento del lugar por foto como entrada a la ficha (ya existe).
- [ ] Microanimaciones adicionales.
- [ ] Narración por voz.

### P2 / Fuera de alcance

- [ ] Vista orbital avanzada, 3D o realidad aumentada con cámara.
- [ ] Estado del territorio en tiempo real (nubosidad, accesos, contaminación lumínica).
- [ ] Dashboard institucional, autenticación y CMS.
- [ ] Salud Andina y contenidos culturales no validados.

## 11. Revisión visual antes del pitch

1. ¿Se entiende el producto en la pantalla inicial sin explicación oral?
2. ¿Queda claro, en la ficha del lugar, cuál es la mejor noche y a qué hora salir?
3. ¿La transición al cielo conserva el lugar y la noche?
4. ¿Se distingue el cielo andino del occidental, y «tu signo» se lee como astronomía y no como horóscopo?
5. ¿Las fuentes, la incertidumbre y las simulaciones están señaladas?
6. ¿Funciona la demo en un teléfono, con y sin buena conexión, y con y sin brújula?
7. ¿El diseño deja ver el paisaje y el cielo en lugar de competir con ellos?

**Definición de terminado:** una experiencia visualmente coherente, usable en móvil y demostrable de punta a punta sobre un punto de observación: **Cuándo → Apuntá → Qué significa**.


## 12. Nueva propuesta de isotipo Pacha — pendiente de validación

**Referencia conceptual:** [`assets/pacha-logo-space-proposal.png`](./assets/pacha-logo-space-proposal.png). Es un recorte del tablero visual de exploración, **no** un logo final ni un archivo vectorial. La referencia anterior permanece en [`assets/pacha-logo-reference.png`](./assets/pacha-logo-reference.png) para comparación.

**Dirección propuesta:** un único arco orbital incompleto, una estrella de cuatro puntas y una silueta de dos cumbres muy reducida. La **órbita y el cielo deben tener más protagonismo** que el paisaje; las montañas funcionan como ancla territorial. Máximo tres elementos y dos colores visibles por variante. La propuesta evita el gran disco solar de la versión anterior, que podía leerse como un logo de turismo convencional.

**Criterios de diseño:**
- Formas geométricas planas, sin glow, gradientes, sombras ni efectos metálicos.
- Trazos suficientemente gruesos para legibilidad a 24–32 px; reducir detalles hasta que la silueta sea reconocible.
- Paleta: marfil `#F5F3EE`, terracota `#E8794E`, fondo noche `#0B1020`.
- No introducir cohetes, logotipos de SpaceX, telescopios ni marcos de cámara.
- Crear `public/brand/pacha-mark.svg` manualmente tras elegir la geometría definitiva; probar versiones a 24, 32, 48 y 128 px y monocromática.
- **Pacha es un módulo de ANDINO:** no sustituir automáticamente el logo principal de la plataforma.

**Estado:** propuesta visual para revisión, no identidad aprobada. En el MVP puede utilizarse un icono geométrico provisional consistente con el sistema.

## 13. Decisiones de la revisión del POC

1. **Rechazado:** estética neón, glow naranja/violeta, degradados artificiales, cristales translúcidos y exceso de tarjetas flotantes.
2. **Aprobado como dirección:** interfaz oscura editorial, contraste marfil, terracota contenido, fotografía real de Jujuy y elementos espaciales discretos.
3. **Logo Pacha en revisión:** nueva propuesta con órbita y estrella predominantes; mantener la marca provisional hasta su aprobación.
4. **Navegación:** el usuario pidió sustituir el acceso señalado por un icono de **documento (`Docs`)**. Como el hackathon exige un MVP acotado, la pantalla Docs solo se incluye si presenta fichas/fuentes reales; de lo contrario se prioriza el acceso a Cielo y se deja Docs para P1. No implementar pestañas sin contenido.
5. **No copiar literalmente los mockups generados:** contienen ejemplos visuales y afirmaciones astronómicas que deben verificarse antes de publicarse. En particular, no prometer visibilidad de Saturno o de la Vía Láctea sin cálculo para ubicación, fecha y hora.

## 14. QA de identidad antes de merge

- [ ] El símbolo Pacha se reconoce en 32 px sin depender de efectos.
- [ ] La órbita, estrella y montañas se distinguen sobre fondo oscuro.
- [ ] No hay glow/neón en botones, tarjetas ni logotipo.
- [ ] Los CTA principales son claros sin sobrecargar la pantalla.
- [ ] La navegación no tiene secciones vacías.
- [ ] El contenido turístico y astronómico está marcado según su fuente y grado de certeza.


---

## Anexo de implementación — Coordinación general y contratos

> Cursor Hackathon Jujuy · MVP · 22/11/2026  
> Fuentes de verdad: [`plan.md`](./plan.md), [`design.md`](./design.md).  
> **No ampliar alcance sin acuerdo de ambos.**

### Propósito

Entregar una PWA móvil demostrable en el tren: **punto de observación → mejor noche → apuntar al cielo → qué significa**, todo calculado para ese mismo lugar. Clientes posibles a futuro no confirmados; **no** construir dashboard, autenticación, CMS, estado del territorio en tiempo real ni integración SpaceX.

### Asignación

| Responsable | Dominio | Guía |
|---|---|---|
| `lautioliver` | Pacha, shell, integración, despliegue | [`implementer-lautioliver.md`](./implementer-lautioliver.md) |
| `jehp23` | Cielo Andino, efemérides, demo astronómica | [`implementer-jehp23.md`](./implementer-jehp23.md) |

### Contrato compartido (cerrar en los primeros 30 min)

```ts
export type PlaceId = 'purmamarca' | 'tilcara' | 'humahuaca'; // ajustar al dataset curado
export interface AndinoPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sourceUrls: string[];
}
export interface ExplorationContext {
  placeId: string;
  datetimeISO: string; // ISO-8601 con zona/offset explícito
}
export interface SkyObject {
  id: string;
  name: string;
  altitudeDeg: number;
  azimuthDeg: number;
  isAboveHorizon: boolean;
}
```

**Integración:** `/explorar?placeId=...` → `/cielo?placeId=...`; si no existe lugar confirmado, mostrar selector. Cielo nunca asume que una foto implica ubicación exacta. Fuente única de lugares en `data/places.ts` o `.json`; los dos módulos importan el mismo contrato.

### Reglas de colaboración

1. `main` desplegable; ramas `feat/pacha-*` y `feat/cielo-*`; PRs pequeños y revisión cruzada.
2. Evitar ediciones simultáneas de `app/layout.tsx`, `app/globals.css`, `shared/`, `data/places.*` y `package.json`. `lautioliver` coordina cambios globales; `jehp23` propone PR para dependencias compartidas.
3. Integrar cada 45–60 min; cada PR debe compilar, pasar lint y una prueba manual breve.
4. Si el P0 está bloqueado, recortar extras. No invertir tiempo en 3D, AR, tracking, autenticación o dashboard.
5. Usar imágenes precargadas con etiqueta «Ejemplo» para contingencia. No presentar respuestas ficticias como inferencia en vivo.
6. Nunca publicar claves de IA; permisos de cámara y ubicación solo bajo acción del usuario.

### Secuencia temporal orientativa (7–7,5 h efectivas)

| Bloque | Objetivo conjunto |
|---|---|
| 0:00–0:30 | Reglas del evento, dataset, contratos, scaffolding y reparto |
| 0:30–1:30 | Ambas rutas navegables con datos de ejemplo |
| 1:30–3:30 | Pacha IA y Cielo cálculos reales funcionando por separado |
| 3:30–4:30 | Paso de contexto Pacha → Cielo; primera demo integrada |
| 4:30–5:45 | Fuentes, incertidumbre, estados de error y fallback |
| 5:45–6:45 | QA en celular, rendimiento, estabilización |
| Últimos 30–45 min | Congelar features, ensayar pitch y demo de respaldo |

### Definition of Done común

- [ ] PWA navegable y usable desde móvil real.
- [ ] Pacha admite foto o ejemplo y ofrece respuesta contextual con fuentes y manejo de incertidumbre.
- [ ] Cielo calcula posiciones de 3–5 objetos desde un lugar y una fecha/hora elegidos.
- [ ] Paso ficha → cielo preserva el lugar y la noche.
- [ ] Cuándo, Apuntá (al menos el plan B) y Qué significa funcionan según `plan.md`, sección 5.
- [ ] Diseño sobrio según `design.md`, con isotipo Pacha provisional según `design.md` y sin neón.
- [ ] Demo online y alternativa precargada identificada como tal.
- [ ] No se atribuye alianza o tecnología propia a SpaceX.


---

## Anexo de implementación — Implementación asignada a lautioliver — Pacha

> Rol: Desarrollador 1 · Responsable Pacha + integración + despliegue.  
> Referencias: [`implementer.md`](./implementer.md), [`plan.md`](./plan.md), [`design.md`](./design.md).

### Misión P0

Construir la experiencia turística que recibe una imagen, permite confirmar un destino, devuelve explicación respaldada por fichas curadas y enlaza con el cielo de ese mismo lugar. Mantener la app integrada y desplegable.

### Propiedad de código

- `app/page.tsx`, `app/explorar/**`, `app/api/pacha/**`.
- `features/pacha/**`, `shared/ui/**`, `app/layout.tsx`, `app/globals.css`.
- `public/brand/pacha-mark.svg` (vectorización de referencia), despliegue y configuración global.
- Coordinar `data/places.*` con `jehp23` antes de modificarlo.

### Orden de ejecución

#### L1 — Base y diseño (P0)
- [ ] Inicializar Next.js + TypeScript + estilos y scripts `dev`, `build`, `lint`.
- [ ] Implementar shell responsive: Inicio, Explorar y acceso visible a Cielo.
- [ ] Aplicar tokens del `design.md`: azul noche, marfil, terracota; **sin glow ni glassmorphism**.
- [ ] Tomar `assets/pacha-logo-space-proposal.png` como propuesta (pendiente de aprobación); crear un isotipo provisional simple con órbita, estrella y montañas; verificar a 32 px.
- [ ] Implementar tarjetas de acceso sin rutas vacías; `Docs` solo si contiene fichas reales.

#### L2 — Flujo Pacha (P0)
- [ ] `ImageUploader`: cámara o archivo, preview, reemplazo, validación de tipo/tamaño.
- [ ] Crear 3–5 fichas de destinos con fuentes comprobables, coordenadas aproximadas y texto revisado.
- [ ] Endpoint servidor `POST /api/pacha/analyze`: recibir imagen, validar, consultar modelo multimodal y fichas.
- [ ] Respuesta estructurada: `candidatePlaceId?`, `confidenceLabel`, `summary`, `sourceUrls[]`, `followUpSuggestions[]`.
- [ ] Si no hay confianza suficiente, pedir elección manual; nunca inventar identificación exacta.
- [ ] Pregunta de seguimiento en el mismo contexto, sin persistir fotos por defecto.
- [x] Sección «Esta noche» con CTA `Mirar el cielo completo` → `/cielo?placeId=...&fecha=...&hora=...`.

#### L3 — Integración y estabilidad (P0)
- [ ] Revisar PR de Cielo y asegurar que los IDs de lugares coinciden.
- [ ] Probar en móvil, especialmente cámara, permisos, safe area y teclado.
- [ ] Añadir imagen de ejemplo y resultado de demo **claramente marcado** para conectividad limitada.
- [ ] Manejar timeouts, API caída, archivo inválido y errores recuperables.
- [ ] Desplegar versión estable y preparar URL/QR para el pitch.

### Contrato de Pacha sugerido

```ts
interface PachaResult {
  candidatePlaceId: string | null;
  confidenceLabel: 'alta' | 'media' | 'insuficiente';
  summary: string;
  sourceUrls: string[];
  followUpSuggestions: string[];
  demoMode: boolean;
}
```

**Regla:** `confidenceLabel` es una clasificación operativa, no una probabilidad calibrada. El modelo no debe inventar URLs de fuentes; enlazar únicamente a referencias presentes en el dataset.

### Criterios de aceptación

1. En 390 px se entiende qué hace Pacha y se puede iniciar la exploración.
2. JPG/PNG válido → resultado con fuentes; archivo inválido → error claro.
3. Foto ambigua → selector manual de destino.
4. Pregunta de seguimiento funciona con el contexto disponible.
5. Clic en «Mirar el cielo completo» abre Cielo con el `placeId`, la fecha y la hora de la ficha.
6. Si la API falla, existe una demo precargada identificada como ejemplo.
7. `npm run build` pasa y la app está desplegada.

### No hacer

Dashboard institucional, login, analytics detallados, rutas completas, tracking continuo, reconocimiento universal, AR, animaciones orbitales, nuevos sistemas de agentes.

### Handoff a jehp23

Compartir temprano: `AndinoPlace`, lista de IDs, ruta `/cielo`, contrato de query params, tokens CSS y layout. No bloquear el desarrollo astronómico esperando el endpoint IA.


---

## Anexo de implementación — Implementación asignada a jehp23 — Cielo Andino

> Rol: Desarrollador 2 · Responsable Cielo Andino + validación astronómica + demo.  
> Referencias: [`implementer.md`](./implementer.md), [`plan.md`](./plan.md), [`design.md`](./design.md).

### Misión P0

Construir una experiencia astronómica **realmente calculada**, no una imagen estática de estrellas: seleccionar un lugar de Jujuy y una fecha/hora, mostrar 3–5 objetos con posición aproximada y conectar con el paisaje visitado en Pacha.

### Propiedad de código

- `app/cielo/**`, `features/cielo/**`, componentes `SkyMap`, `DateTimePicker`, `CelestialObjectCard`.
- Tests de cálculos astronómicos y fixtures de demostración.
- `data/astronomy.*` si es necesario; `data/places.*` se acuerda con `lautioliver`.
- Evitar editar `app/layout.tsx`, `app/globals.css` y `package.json` sin coordinación.

### Orden de ejecución

#### J1 — Motor de cálculo (P0)
- [ ] Elegir biblioteca confiable de efemérides (p. ej., `astronomy-engine`) y documentar versión.
- [ ] Usar latitud/longitud del lugar seleccionado y fecha/hora con zona explícita; convertir correctamente a UTC para cálculo.
- [ ] Calcular altitud y acimut de 3–5 objetos apropiados para la demo; filtrar por horizonte cuando corresponda.
- [ ] Probar resultados contra una referencia astronómica independiente para al menos un lugar/fecha.
- [ ] Separar posiciones calculadas de textos educativos generados o curados.

#### J2 — Interfaz Cielo (P0)
- [ ] Pantalla `/cielo` con selector de lugar, fecha y hora.
- [ ] Leer `placeId` de query params y resolverlo desde el dataset compartido; fallback a selector manual.
- [ ] Crear mapa 2D legible con horizonte, puntos, etiquetas y selección táctil.
- [ ] Ficha del objeto: nombre, tipo, altitud/acimut y explicación breve.
- [ ] Etiqueta visible: «Posiciones calculadas para la fecha y hora seleccionadas».
- [ ] Aclarar que **visibilidad observacional** depende también de nubosidad, luz, horizonte local y otros factores.

#### J3 — Integración y demo (P0)
- [ ] Verificar transición Pacha → Cielo manteniendo `placeId`.
- [ ] Añadir enlace `Volver al paisaje` con contexto preservado.
- [ ] Preparar lugar y hora de demostración con objetos calculados previamente verificados.
- [ ] Probar interacción táctil y legibilidad en 320–390 px.
- [ ] Ensayar explicación oral de 45–60 s del valor espacial/astroturístico.
- [ ] Revisar el flujo Pacha de `lautioliver` como QA cruzado.

### Contrato astronómico sugerido

```ts
interface SkyQuery {
  placeId: string;
  datetimeISO: string;
}
interface SkyObject {
  id: string;
  name: string;
  altitudeDeg: number;
  azimuthDeg: number;
  isAboveHorizon: boolean;
}
```

**Importante:** el mapa puede ser una proyección simplificada; debe indicarse que es esquemático. Solo afirmar orientación real del teléfono cuando «Apuntá» use la brújula y funcione en el dispositivo; nunca reconocimiento AR. No inventar que una constelación es tradicionalmente andina sin validación cultural.

### Criterios de aceptación

1. Seleccionar lugar y fecha/hora cambia los resultados calculados.
2. Los objetos bajo el horizonte se identifican como no visibles geométricamente o se excluyen con explicación.
3. Al entrar desde Pacha se conserva el lugar.
4. La pantalla funciona sin sensores del teléfono ni API de IA.
5. El mapa permite tocar un objeto y leer su ficha.
6. Hay una demo reproducible y verificada para una fecha/hora concreta.
7. `npm run build` pasa y se revisó en un teléfono real.

### No hacer

AR, brújula obligatoria, reconocimiento de estrellas por cámara, visualización orbital 3D, relatos quechuas inventados, clima en tiempo real, mapa global, cuenta de usuario.

### Handoff a lautioliver

Entregar temprano: ruta `/cielo`, requisitos de `placeId`, dependencias necesarias, resultados de prueba de efemérides y escenario de demo. Abrir PRs pequeños y coordinar cualquier cambio global.
