# Verification

Verificación realizada el 2026-09-08 ejecutando el proyecto de forma directa (Python 3.14 venv para el backend,
Node 24 / npm para el frontend). Docker no está disponible en este entorno de ejecución, por lo que no se pudo
usar `docker compose up --build` tal como indica el README; en su lugar se instalaron dependencias y se
levantaron ambos servicios con los comandos declarados en `backend/requirements.txt` y `frontend/package.json`.

## Cómo se verificó

- Backend: `python -m pip install -r backend/requirements.txt`, luego `pytest` (15 tests) y
  `uvicorn app.main:app --host 127.0.0.1 --port 8000`. Se comprobó `GET /health` → `{"status":"ok"}` y
  `GET /api/metrics` → lista de movimientos JSON.
- Frontend: `npm install`, luego `npx vitest run` (5 tests), `npx eslint .` (0 errores) y `npm run dev`
  (Vite en `:5173`).

## Principales afirmaciones comprobadas

- ✅ Backend FastAPI sin base de datos: los movimientos financieros se generan en memoria y de forma
  determinista con `generate_mock_movements(seed=42)`.
  Evidencia: `backend/app/routes.py:94-104`.
- ✅ Puertos reales: frontend `5173`, backend `8000` (además de `5678` para `debugpy`).
  Evidencia: `docker-compose.yml`, confirmado sirviendo ambos servicios.
- ✅ Backend expone 9 endpoints (`/health` + 8 bajo `/api/metrics*`), pero el frontend solo consume
  `GET /api/metrics`.
  Evidencia: `frontend/src/App.tsx:16`, `backend/app/routes.py`.
- ✅ Tests verdes en ambos servicios (15 backend / 5 frontend), lint de frontend sin errores.

## Errores/suposiciones detectadas y corregidas

- ❌ Se asumió que `frontend/src/lib/mock-data.ts` alimentaba el dashboard.
  Corrección: no se importa en ningún archivo del proyecto (`grep` sin coincidencias); es una fixture
  huérfana, el dashboard usa siempre datos reales del backend.
  Evidencia: `frontend/src/lib/mock-data.ts`, `frontend/src/App.tsx`.

- ❌ Se asumió que el periodo mostrado en la cabecera (`"2024 — Full Year"`) reflejaba el rango real de
  los datos.
  Corrección: el label está hardcodeado; el backend genera 12 meses de datos relativos a la fecha del
  sistema (`_year_for_month`), no al año 2024. Ejecutando el proyecto el 2026-09-08, la API devolvió
  movimientos desde `2025-09` en adelante.
  Evidencia: `frontend/src/App.tsx:49`, `frontend/src/components/dashboard/dashboard-header.tsx:7`,
  `backend/app/routes.py:65-68`.

- ⚠️ El proxy de Vite (`/api` → `http://backend:8000`) solo resuelve dentro de la red de Docker Compose,
  donde `backend` es el nombre del servicio. Al ejecutar frontend y backend nativamente (sin Docker, como
  se hizo en esta verificación), la petición proxied falla con `Error: getaddrinfo ENOTFOUND backend`; el
  backend en sí respondía correctamente en `http://127.0.0.1:8000`. Esto no es un bug del repositorio (el
  mecanismo soportado es `docker compose up`), pero es relevante para cualquiera que intente ejecutar los
  servicios fuera de Docker: hay que apuntar `VITE_API_BASE_URL` directamente al backend.
  Evidencia: `frontend/vite.config.ts:11-16`, `frontend/.env.example`.

## No verificable / fuera de alcance

- No se pudo verificar el flujo exacto vía `docker compose up --build` (Docker no instalado en este
  entorno). El Dockerfile de cada servicio y `docker-compose.yml` son coherentes con el comportamiento
  observado al ejecutar los servicios de forma nativa (mismos comandos de arranque, mismos puertos).
