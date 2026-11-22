# ANDINO

**Tu mejor noche de cielo en Jujuy.** PWA de turismo inteligente y astroturismo para Jujuy, hecha para la Cursor Hackathon Jujuy. Pensada para los pasajeros del **Tren Solar de la Quebrada**: cubre sus siete paradas (Volcán, Tumbaya, Purmamarca, Posta de Hornillos, Maimará, la bodega El Bayeh y Tilcara), en español y en inglés.

- **Pacha** (`/explorar`): foto desde el tren o en una parada → qué es el lugar, su territorio y su historia, con fuentes → pregunta de seguimiento. Responsable: `lautioliver`.
- **Cielo Andino** (`/cielo`): el cielo de ahora, en vivo, para apuntar con el teléfono; o lugar + fecha/hora → objetos celestes calculados. Motor y pantalla de `jehp23`; desde la v4 lo lleva `lautioliver`.

Documentación: [`docs/plan.md`](docs/plan.md) (plan del proyecto) y [`docs/design.md`](docs/design.md) (diseño, contratos e implementación; fuente de verdad).

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

## Estructura

```text
app/            rutas: / , /explorar , /cielo
features/pacha  lautioliver
features/cielo  motor y pantalla de jehp23; desde la v4, lautioliver
features/cuando lautioliver
features/signo  lautioliver
shared/         contratos (types.ts), UI base e idioma (i18n/lang.ts) — coordinar antes de cambiar
data/           dataset compartido (places.ts) — coordinar antes de cambiar
docs/           plan.md y design.md
```

## Reglas de trabajo

- `main` siempre desplegable; ramas cortas `feat/pacha-*` / `feat/cielo-*`, PRs chicos con revisión cruzada.
- Cambios en `app/layout.tsx`, `app/globals.css`, `shared/`, `data/places.*` y `package.json` se coordinan antes.
- Claves de IA solo en el servidor (`.env.local`, nunca commiteado).
- ANDINO no tiene afiliación con SpaceX.
