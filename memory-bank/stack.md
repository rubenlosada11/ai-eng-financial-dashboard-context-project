# Technology stack

Todas las versiones proceden de los manifests reales del repositorio (no de suposición).

## Frontend — `frontend/`

- React `19.2.4` + React DOM `19.2.4` — `frontend/package.json`
- TypeScript `~6.0.2` — `frontend/package.json`
- Vite `8.0.4` como bundler/dev server, con `@vitejs/plugin-react` — `frontend/vite.config.ts`
- Tailwind CSS `4.2.2` vía `@tailwindcss/vite` (no `tailwind.config.js` clásico) — `frontend/package.json`,
  `frontend/src/index.css`
- Componentes UI estilo shadcn/ui (`style: "new-york"`, sin CSS variables de shadcn propias — usa las
  suyas en `index.css`) — `frontend/components.json`
- `recharts` `3.8.1` para los gráficos de líneas — `frontend/src/components/dashboard/*-chart.tsx`
- `lucide-react` `1.8.0` para iconos
- `class-variance-authority`, `clsx`, `tailwind-merge` para composición de clases (`cn()` en
  `frontend/src/lib/utils.ts`)
- Lint: ESLint `9.39.4` con flat config (`frontend/eslint.config.js`), `typescript-eslint`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Test: Vitest `4.1.4` (+ `@vitest/coverage-v8`) — tests colocados junto al código
  (`frontend/src/lib/financial-utils.test.ts`)
- Node `24-alpine` en el Dockerfile del frontend — `frontend/Dockerfile`

## Backend — `backend/`

- Python — `python:3.13-slim` en `backend/Dockerfile` (verificado también funcional con Python 3.14
  al ejecutar nativamente en este entorno)
- FastAPI + Uvicorn (`uvicorn[standard]`) como servidor ASGI — `backend/requirements.txt`,
  `backend/app/main.py`
- Pydantic (vía FastAPI) para los modelos de datos (`FinancialMovement`, `MetricsFacets`, etc.) —
  `backend/app/routes.py`
- `debugpy` para depuración remota (puerto `5678`) — `backend/Dockerfile`, `docker-compose.yml`
- Test: `pytest` + `pytest-cov`, cliente HTTP de test vía `httpx`/`fastapi.testclient` —
  `backend/tests/test_routes.py` (15 tests), `backend/tests/conftest.py`

## Base de datos

Ninguna. Los datos son generados en memoria por request (`generate_mock_movements`), sin ningún
driver de base de datos en `backend/requirements.txt`.

## Infraestructura / DX

- Orquestación con Docker Compose (`docker-compose.yml`): servicio `frontend` (puerto `5173`) y
  servicio `backend` (puertos `8000` y `5678`), cada uno con su propio `Dockerfile`.
- Hot-reload vía volúmenes montados (`./frontend:/app`, `./backend:/app`); `node_modules` excluido del
  montaje mediante volumen anónimo (`/app/node_modules`).
- El proxy de desarrollo de Vite reenvía `/api` → `http://backend:8000` (nombre de servicio de Docker
  Compose, no resuelve fuera de esa red — ver `memory-bank/current-state.md`).
- Sin CI configurado (no existe `.github/workflows` ni ningún otro pipeline).
