# Rediseño espacial — «mágico pero real»

> Pedido de `jehp23` (22/11/2026): la app se siente genérica; queremos algo espacial, mágico, que enamore.
> Decisiones: alcance **toda la app**; estética **mágico pero real** (respeta `design.md`: sin neón, glow ni glassmorphism).
> Lo que toca archivos de `lautioliver` (Inicio, `layout`, `globals.css`, `shared/ui`) va en un PR aparte para que lo apruebe.

## Idea central

Lo mágico sale de que **es real**: el cielo que se ve es el cielo calculado para ese lugar y ese momento, con estrellas, constelaciones y Vía Láctea en su posición verdadera. Nada decorativo que mienta.

## Etapa 1 — Cielo inmersivo (`features/cielo`, de jehp23)

- **Catálogo real**: 1.627 estrellas (mag ≤ 5) con su color (índice B−V), líneas y nombres en español de las 88 constelaciones y la Vía Láctea. Fuente: d3-celestial (BSD-3, © Olaf Frohn), generado con `scripts/generar-catalogo.mjs` a `data/cielo/catalogo.json`.
- **Vista panorámica**: en lugar del domo, mirás hacia un rumbo (proyección estereográfica) con el horizonte abajo; arrastrás para girar 360°. Botones N/E/S/O.
- **Color del cielo según la altura del Sol** (día, crepúsculo, noche), calculado.
- **Titileo suave** de las estrellas (se apaga con `prefers-reduced-motion`).
- **Viaje en el tiempo**: control para adelantar o atrasar horas y ver girar el cielo.
- Luna, planetas y estrellas destacadas siguen siendo tocables y abren su ficha.

## Etapa 2 — Toda la app (PR para lautioliver)

- **Inicio**: el cielo real de Jujuy ahora mismo de fondo, detrás del titular.
- **Transición Tierra → Cielo** (`design.md` §7): la foto del lugar se funde con el cielo calculado al pasar de Pacha a Cielo.
- Navegación y detalles tipográficos con el mismo lenguaje.

Cómo quedó:

- **Inicio** (`features/cielo/CieloAhora.tsx`): arriba el cielo calculado para Purmamarca con la hora del teléfono, mirando al sur; abajo la foto del cerro, que se funde con él. Una leyenda dice lugar, hora y si es de día, crepúsculo o de noche. De día el cielo es celeste y sin estrellas: es lo que hay. El catálogo se baja aparte para no demorar el titular.
- **Tierra → Cielo** (`shared/tierraCielo.ts`): al tocar «Ver el cielo desde acá», la foto de Pacha pasa a ocupar el lugar del cielo (view transition de 350 ms) y se desvanece sobre el cielo calculado (900 ms). Solo al navegar desde Pacha: recargar o compartir `/cielo` no la repite. Con la foto propia del usuario no hay fundido (su object URL se libera al salir). Respeta `prefers-reduced-motion`.
- `features/cielo/lienzo.ts`: el dibujo del firmamento, compartido entre el cielo inmersivo y el de fondo.

## Estado

- [x] Etapa 1 (PR de cielo inmersivo)
- [x] Etapa 2: Inicio y transición Tierra → Cielo
- [ ] Etapa 2: navegación y detalles tipográficos
