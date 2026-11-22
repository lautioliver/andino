# Cielo Andino — escenario de demo y guion

> Épica #2 · J3. Responsable: `jehp23`.

## Escenario verificado

**Purmamarca, madrugada del 23/11/2026, 03:00 (UTC−3).**

- URL directa: `/cielo?placeId=purmamarca&fecha=2026-11-23&hora=03:00`
- En la app: botón **«Ver la noche de la demo»**, al pie de `/cielo`.
- El Sol está a −38°, así que es noche cerrada. La Luna está iluminada al 96 % (casi llena), lo que opaca las estrellas débiles; los cinco objetos son brillantes.

| Objeto | Altitud | Acimut | Verificado contra |
|---|---|---|---|
| Luna | 24,5° | 308,5° (noroeste) | JPL Horizons (DE441), diferencia < 0,01° |
| Júpiter | 18,9° | 65,3° (noreste) | JPL Horizons, diferencia < 0,01° |
| Saturno | 10,6° | 275,6° (oeste) | JPL Horizons, diferencia < 0,01° |
| Sirio | 74,4° | 66,1° (noreste) | Cálculo independiente (precesión de Meeus + tiempo sidéreo IAU 1982), < 0,1° |
| Acrux (Cruz del Sur) | 16,7° | 152,5° (sureste) | Cálculo independiente, < 0,1° |

`npm test` vuelve a comprobarlo (`features/cielo/cielo.test.mjs`, «escenario de demo»). Si cambian las coordenadas de Purmamarca en `data/places.ts`, ese test falla a propósito: hay que volver a consultar Horizons y actualizar la tabla.

**Por qué esta hora:** a las 22:00 la Cruz del Sur está bajo el horizonte y Júpiter todavía no salió. A las 03:00 los cinco objetos están a más de 10° de altura.

## Recorrido de la demo (Tierra → Cielo)

1. `/explorar` → elegir Purmamarca (o la foto de ejemplo) → ficha con fuentes.
2. Bajar hasta **«Esta noche en Purmamarca»** (Luna, objetos visibles a las 22:00) → **«Mirar el cielo completo»** → `/cielo?placeId=purmamarca&fecha=<hoy>&hora=22:00`: mismo lugar y los mismos objetos que la ficha.
3. **«Ver la noche de la demo»** → los cinco objetos en el mapa. Tocar **Acrux** y después **Júpiter** para mostrar las fichas.
4. **«Volver al paisaje»** → `/explorar?placeId=purmamarca`, con el lugar intacto.

## Guion oral (45–60 s)

> «Desde el mismo lugar que acabamos de explorar, Purmamarca, Cielo Andino calcula qué hay en el cielo para la fecha y hora que elijas. No es una imagen genérica: las posiciones salen de un motor de efemérides que comparamos contra JPL Horizons, el servicio de la NASA, y coinciden en centésimas de grado.
>
> Esta madrugada, a las 3, se ven la Luna casi llena hacia el noroeste, Júpiter y Sirio hacia el noreste, Saturno bajo en el oeste y, al sureste, Acrux, la estrella más brillante de la Cruz del Sur.
>
> La IA no inventa nada de esto: el cálculo es astronómico y los textos tienen fuentes. Y somos honestos con el visitante: le avisamos si es de día y que las nubes, la luz y los cerros también cuentan.
>
> Para Jujuy, es una forma concreta de sumar el cielo a la oferta turística: el mismo destino, de día y de noche.»

## Checklist en celular real (pendiente, la hace una persona)

- [ ] 320 y 390 px: el mapa, las etiquetas y la lista se leen sin zoom.
- [ ] Tocar cada objeto en el mapa abre su ficha (área táctil suficiente) y la ficha queda a la vista.
- [ ] El selector de fecha y hora nativo funciona (iOS y Android) y cambia el resultado.
- [ ] Recargar con `?placeId=…&fecha=…&hora=…` conserva lugar y momento.
- [ ] Modo avión después de cargar `/cielo`: el cálculo sigue funcionando.
- [ ] Pacha → Cielo → «Volver al paisaje» conserva el lugar.
- [ ] La barra inferior no tapa el final de la pantalla (safe area).
