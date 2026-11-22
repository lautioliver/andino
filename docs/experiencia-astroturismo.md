# Experiencia de astroturismo — «Un día y una noche en la Quebrada»

> Propuesta de `jehp23` (22/11/2026) para el rediseño completo. **Borrador para acordar con `lautioliver`**: cambia Inicio, la navegación y parte de `design.md`.
> Reemplaza la etapa 2 pendiente de `rediseno-espacial.md` («navegación y detalles tipográficos») y la amplía.

## La historia

ANDINO deja de ser dos módulos (Pacha y Cielo) y pasa a ser **un día y una noche en la Quebrada**. La app sigue el reloj real del lugar y en cada momento responde una sola pregunta: **¿qué puedo hacer ahora?**

> De día mirás la Tierra. Al atardecer esperás. De noche mirás hacia arriba, desde el mismo lugar.

Es el mismo hilo de `design.md` («paisaje → interpretación → cielo desde el mismo lugar»), contado en el tiempo y no solo con dos botones.

**Lo mágico sale de que es real.** Cada hora, color y estrella que muestra la app está calculado para ese lugar y ese momento. Ejemplo, Purmamarca hoy (calculado con astronomy-engine):

| Momento | Hora |
|---|---|
| Sale la Luna | 17:59 |
| Se pone el Sol | 19:48 |
| Primeras estrellas (fin del crepúsculo civil) | 20:14 |
| Noche cerrada | 21:14 |
| Se pone la Luna | 05:10 |
| Amanece | 06:27 |

Luna al 96 %: es noche de Luna, no de Vía Láctea. La app lo dice así, con honestidad, y propone qué mirar en una noche de Luna llena.

## Principios

1. **El momento manda.** La pantalla de entrada cambia según la hora real: no es la misma a las 11 que a las 23.
2. **Una sola escena.** El cielo calculado es el fondo de toda la app; el contenido flota encima, sin cajas.
3. **La luz sale de cosas reales.** Brillan las estrellas (halo según su magnitud), la Luna con su fase y el resplandor del Sol bajo el horizonte. **La interfaz no brilla**: sin glow, neón ni vidrio (`design.md` §13 sigue vigente).
4. **Decir hacia dónde mirar en lenguaje humano.** «Al noreste, dos puños sobre el horizonte», no «acimut 47°, altitud 22°». Los números quedan a un toque.
5. **Honestidad visible.** Qué es calculado, qué es curado, qué no sabemos (nubes, cerros, luz de la ciudad).
6. **Funciona en el cerro.** Sin conexión, sin sensores y sin cuenta.
7. **Mobile first, de verdad.** Se diseña y se prueba primero a 390 px (y 320 px), con una mano y de noche; el escritorio es una adaptación, no al revés. Controles al alcance del pulgar (abajo), objetivos táctiles de 48 px, hoja inferior que se arrastra, safe areas, sin hover como único indicio, y legible con el brillo de pantalla al mínimo.

## Los cinco momentos

### 1. Llegada — Inicio (`/`)

Una pantalla, tres estados según la altura del Sol en el lugar elegido (por defecto Purmamarca):

| Estado | Fondo | Titular | Acción principal | Acción secundaria |
|---|---|---|---|---|
| **Día** (Sol > 0°) | Foto del lugar fundida con el cielo celeste real | «Explorá la Tierra. Descubrí el universo.» | Explorar un paisaje | Línea fija: «Esta noche: oscurece a las 21:14 · Luna al 96 %» |
| **Atardecer** (Sol entre 0° y −12°) | El cielo real cambiando de color | «Ya casi. Las primeras estrellas, a las 20:14.» | Ver cómo oscurece | Explorar un paisaje |
| **Noche** (Sol < −12°) | El cielo real con sus estrellas | «Mirá hacia arriba.» | Empezar el recorrido | Explorar el cielo libre |

- La línea «Esta noche…» es el anzuelo del día: une la Tierra con el cielo antes de que el visitante lo pida.
- Selector de lugar discreto arriba: Purmamarca · Tilcara · Humahuaca.
- Para la demo de día: un control «Ver cómo es de noche» salta a la noche de demo, marcada como ejemplo.

### 2. De día — Pacha (`/explorar`)

Se mantiene el flujo actual (foto o destino → ficha con fuentes), con un tratamiento editorial:

- **Captura:** «¿Qué estás viendo?» sobre la foto a sangre. Los tres destinos como tarjetas grandes con foto, no como lista.
- **Resultado:** la foto ocupa la primera pantalla; el nombre del lugar en grande abajo, sobre la foto. Debajo, el resumen en 2–4 frases y las fuentes como notas al pie numeradas.
- **El cierre es el puente al cielo:** un bloque fijo al final de la ficha: «Esta noche, desde Purmamarca» + horas de oscuridad + Luna + botón «Ver el cielo desde acá». Al tocarlo, la transición Tierra → Cielo que ya está en el PR #10.

### 3. El atardecer — el momento firma

Pantalla de espera dentro de Cielo cuando el Sol está entre 0° y −12°:

- El cielo de la app cambia de color en vivo con el Sol real. Las estrellas aparecen una por una, en el orden real: primero las más brillantes, después el resto.
- Una cuenta regresiva serena: «Primeras estrellas en 18 min» → «Noche cerrada en 1 h 02 min».
- La Luna y los planetas que ya se ven aparecen marcados: «La Luna ya salió, al este».
- **Para el pitch:** un control «Adelantar el atardecer» reproduce esas 1,5 h en 20 segundos. Es la escena para mostrar en vivo.

### 4. La noche — Tu recorrido

El corazón de la experiencia. En vez de un mapa suelto, **una guía de 3 a 5 paradas** ordenadas para esa noche y ese lugar, elegidas por cálculo entre lo que está sobre el horizonte:

1. **Parada:** el cielo gira solo hasta el objeto y lo marca.
2. **Hacia dónde mirar**, en lenguaje humano: rumbo + altura en puños con el brazo estirado (un puño ≈ 10°).
3. **Qué estás viendo**, en 2 frases curadas, con su fuente.
4. **Siguiente** → la próxima parada.

Paradas posibles (todas con texto curado y fuente): Luna con su fase, planetas visibles, Sirio, la Cruz del Sur y los Punteros, Orión, las Nubes de Magallanes y la Vía Láctea (solo en noches sin Luna).

- Al final: «Explorar libre» abre el cielo inmersivo del prototipo, con viaje en el tiempo.
- **Calidad de la noche**, en una línea, calculada solo con lo que sabemos: horas de oscuridad sin Luna. «Noche de Luna: ideal para la Luna y los planetas; la Vía Láctea no se va a ver». Sin prometer clima.

### 5. El recuerdo — la postal

Al terminar el recorrido: **una postal del cielo de esa noche**, con el nombre del lugar, la fecha y lo que viste. Se descarga como imagen o se comparte. Es lo que el turista se lleva y lo que difunde Jujuy.

## Detalles que la hacen exquisita

- **Modo noche rojo:** toda la pantalla en rojo tenue para no arruinar la vista adaptada a la oscuridad. Se activa con un toque o solo, en noche cerrada, si la persona lo acepta.
- **Movimiento con sentido:** el cielo nunca salta, gira. Duraciones fijas: 150 ms para tocar, 300 ms para paneles, 800 ms para girar el cielo. Todo se apaga con `prefers-reduced-motion`.
- **Botones con todos sus estados:** reposo, presionado (se hunde 1 px y se achica al 97 %), foco visible, deshabilitado y cargando.
- **Profundidad sin brillo:** una escala de dos sombras oscuras (hoja y elevado), nunca de color.
- **Tipografía:** Space Grotesk grande y ajustada para lugares y horas; Inter para leer; números tabulares en las horas.
- **Navegación:** tres destinos con ícono y estado activo: Inicio · Paisaje · Cielo.
- **Sin conexión:** el catálogo, las fotos de demo y las fichas quedan guardados después de la primera visita.

## Lo que no hacemos

- Relatos, nombres o constelaciones andinas sin fuente y revisión cultural (`plan.md` §3.2).
- Realidad aumentada, brújula obligatoria o clima en vivo.
- Afirmar que algo «se va a ver»: siempre «está sobre el horizonte» y la aclaración de nubes, cerros y luz.

## Qué hay que construir

| Pieza | Base | Nuevo |
|---|---|---|
| Horas del día y la noche | astronomy-engine (`SearchRiseSet`, `SearchAltitude`) | Módulo puro con tests: ocaso, crepúsculos, noche cerrada, Luna |
| Inicio según el momento | `CieloAhora` del PR #10 | Los tres estados y la línea «Esta noche» |
| Escena de Cielo | Prototipo `/prototipo` | Pasarlo a `/cielo` y arreglar la Vía Láctea y la hoja |
| Atardecer | Color del cielo ya calculado | Aparición ordenada de estrellas y cuenta regresiva |
| Recorrido | Motor y fichas actuales | Elección de paradas, «puños», textos nuevos con fuente |
| Postal | Canvas | Exportar imagen |
| Modo rojo | Tokens de color | Variante de tokens y del canvas |

## Orden propuesto (cada uno, un PR)

1. **Horas del día y la noche** (lógica pura y tests). Destraba todo lo demás.
2. **Escena de Cielo** en `/cielo`, a partir del prototipo.
3. **Inicio según el momento** (archivos de `lautioliver`).
4. **Recorrido guiado.**
5. **Atardecer.**
6. Si queda tiempo: postal, modo rojo y Pacha editorial.

## Para decidir

- [ ] `lautioliver`: ¿aprueba el cambio de Inicio y de la navegación?
- [ ] Textos curados de las paradas nuevas (Cruz del Sur, Orión, Nubes de Magallanes, Vía Láctea): quién los escribe y con qué fuentes.
- [ ] Cuánto entra en el tiempo que queda de hackathon.
