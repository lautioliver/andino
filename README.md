# ANDINO

**Explorá la Tierra. Descubrí el universo.** PWA de turismo inteligente y astroturismo para Jujuy, hecha para la Cursor Hackathon Jujuy.

- **Pacha** (`/explorar`): foto de un paisaje → explicación con fuentes → pregunta de seguimiento. Responsable: `lautioliver`.
- **Cielo Andino** (`/cielo`): lugar + fecha/hora → objetos celestes calculados. Motor y pantalla de `jehp23`; desde la v4 lo lleva `lautioliver`.

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
shared/         contratos (types.ts) y UI base — coordinar antes de cambiar
data/           dataset compartido (places.ts) — coordinar antes de cambiar
docs/           plan.md y design.md
```

## Reglas de trabajo

- `main` siempre desplegable; ramas cortas `feat/pacha-*` / `feat/cielo-*`, PRs chicos con revisión cruzada.
- Cambios en `app/layout.tsx`, `app/globals.css`, `shared/`, `data/places.*` y `package.json` se coordinan antes.
- Claves de IA solo en el servidor (`.env.local`, nunca commiteado).
- ANDINO no tiene afiliación con SpaceX.
