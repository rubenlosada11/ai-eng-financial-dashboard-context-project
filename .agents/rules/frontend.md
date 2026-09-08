# Frontend rules

## Nombre
Configuración de red del frontend, datos hardcodeados y fixtures huérfanas.

## Alcance
Cambios en `frontend/vite.config.ts`, `frontend/src/App.tsx`,
`frontend/src/components/dashboard/dashboard-header.tsx`, o cualquier uso de
`frontend/src/lib/mock-data.ts`.

## Justificación
El proxy de Vite reenvía `/api` al hostname `backend`, que solo existe dentro de la red de Docker
Compose. Además, la cabecera del dashboard muestra un periodo hardcodeado (`"2024 — Full Year"`) que
ya no coincide con el rango real de datos (ver `.agents/rules/backend.md`). Por último,
`mock-data.ts` no se importa en ningún archivo del proyecto: es una fixture huérfana, no la fuente de
datos del dashboard.

## Evidencia
- `frontend/vite.config.ts:11-16` (`proxy: { "/api": { target: "http://backend:8000" } }`)
- `docker-compose.yml:14` (servicio `backend`, nombre que resuelve el proxy)
- Confirmado ejecutando frontend y backend nativamente (sin Docker):
  `Error: getaddrinfo ENOTFOUND backend` (ver `verification.md`)
- `frontend/src/App.tsx:49` y `frontend/src/components/dashboard/dashboard-header.tsx:7`
  (`"2024 — Full Year"` hardcodeado)
- `frontend/src/lib/mock-data.ts` sin ningún `import` en el resto de `frontend/src`
  (comprobado con búsqueda de texto)

## Instrucción accionable
- Al ejecutar los servicios fuera de `docker compose` (por ejemplo, `npm run dev` nativo en el host),
  fijar `VITE_API_BASE_URL` en `frontend/.env` apuntando directamente al backend
  (`http://localhost:8000` o el host real), copiando `frontend/.env.example` como base. No asumir que
  el proxy de Vite funcionará sin la red de Docker Compose.
- Si se necesita mostrar el periodo de datos en la UI, derivarlo de la API (`/api/metrics/facets`) en
  vez de un string fijo.
- Si se reactiva `mock-data.ts` como fixture (tests, modo offline, Storybook), importarlo
  explícitamente y documentar el motivo; no asumir que ya está conectado al dashboard.

## Qué evitar
- No "arreglar" el fallo del proxy fuera de Docker cambiando `vite.config.ts` para apuntar a
  `localhost` de forma permanente: rompería la ejecución dentro de Docker Compose, que es el
  mecanismo soportado por el README.
- No cambiar el año del label hardcodeado por otro año fijo (p. ej. "2026"): el rango de datos es
  dinámico, cualquier valor fijo se desincronizará de nuevo.
- No borrar `mock-data.ts` asumiendo que es un leftover sin más comprobación, ni tampoco asumir que
  alimenta el dashboard: ambas suposiciones son incorrectas sin verificar primero los imports.
