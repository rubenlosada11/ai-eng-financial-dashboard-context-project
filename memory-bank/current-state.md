# Current state

Estado verificado ejecutando el proyecto el 2026-09-08 (detalle completo en `verification.md`).

## Qué funciona (verificado)

- **`docker compose up --build`** (mecanismo soportado por el README): ambos contenedores arrancan
  (`backend-1` en `8000`/`5678`, `frontend-1` en `5173`); el proxy de Vite resuelve `backend:8000`
  dentro de la red de Docker; `pytest` (15/15) y `vitest run` (6/6) pasan ejecutados dentro de los
  propios contenedores. Verificado el 2026-09-08 — ver `verification.md`, sección "Verificación con
  Docker".
- Backend: también instala/arranca de forma nativa con `pip install -r backend/requirements.txt` +
  `uvicorn app.main:app --host 0.0.0.0 --port 8000`. `GET /health` y los 8 endpoints bajo
  `/api/metrics*` responden correctamente. `pytest` → **15/15 tests pasan**.
- Frontend: también instala/arranca de forma nativa con `npm install` + `npm run dev` (Vite, puerto
  `5173`). `npx vitest run` → **6/6 tests pasan**, `npx eslint .` → 0 errores, `npx tsc -b` → 0 errores.
- Flujo completo frontend→backend verificado dentro de Docker por HTTP real (`curl` al proxy de Vite
  devolviendo el JSON del backend), y por tipos + tests unitarios para la lógica de cálculo.

## Qué NO funciona tal cual / limitaciones conocidas

- **Proxy de Vite fuera de Docker**: `frontend/vite.config.ts` reenvía `/api` a `http://backend:8000`,
  hostname que solo resuelve dentro de la red de Docker Compose (confirmado que sí resuelve dentro de
  Docker, y que falla con `ENOTFOUND backend` fuera de Docker). Al ejecutar los servicios de forma
  nativa hay que fijar `VITE_API_BASE_URL` en `frontend/.env` apuntando al backend real.
- **Sin verificación visual en navegador**: no fue posible descargar un binario de Chromium en el
  entorno de ejecución del agente (sin acceso de red saliente para ese paquete específico), así que
  ningún cambio de UI se confirmó con una captura de pantalla automatizada; la verificación se apoyó
  en typecheck, lint, tests unitarios y llamadas HTTP directas. Comprobarlo visualmente
  (`docker compose up --build` y abrir `http://localhost:5173` en un navegador normal) queda como
  paso manual opcional.

## Gaps conocidos (respaldados por evidencia, no suposición)

- 7 de los 9 endpoints del backend (`/summary`, `/categories/top`, `/comparison`, `/alerts`, `/b2b`,
  `/b2c`, y `/health` solo como healthcheck) no tienen ningún caller en el frontend todavía —
  funcionalidad probada pero no integrada en la UI.
- `frontend/src/lib/mock-data.ts` es una fixture sin usar (sin imports en el resto del proyecto).
- No hay tests de componentes React (solo de funciones puras en `frontend/src/lib/*.test.ts`).
- No hay CI: nada bloquea automáticamente un cambio con tests rotos o lint fallido.
- No hay base de datos ni persistencia: cada request regenera el dataset en memoria.
- No hay autenticación ni control de acceso; CORS abierto a cualquier origen.

## Configuración necesaria

- Ninguna variable de entorno es obligatoria para `docker compose up --build` (mecanismo soportado
  por el README) ni para ejecutar cada servicio nativamente con sus puertos por defecto.
- `VITE_API_BASE_URL` (frontend, opcional) — solo necesaria para apuntar el frontend a un backend en
  un origen distinto del proxy de Vite (p. ej. ejecución nativa sin Docker). Plantilla en
  `frontend/.env.example`.

## Prioridades

No hay roadmap ni prioridades documentadas en el repositorio (ni en README, ni en issues visibles
desde el código). No se documentan aquí para no inventar planes no respaldados por evidencia.
