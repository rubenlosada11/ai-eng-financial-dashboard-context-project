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

## Verificación con Docker (2026-09-08, posterior a la verificación inicial)

Docker no estaba disponible al hacer la verificación inicial (ver más abajo). Una vez instalado,
se ejecutó el mecanismo real documentado en el README:

- `docker compose up --build` → ambos servicios arrancan correctamente (`docker compose ps`):
  `backend-1` (puertos `8000`, `5678`) y `frontend-1` (puerto `5173`).
- `curl http://localhost:8000/health` → `200`.
- `curl http://localhost:5173/` → `200`.
- **Proxy de Vite dentro de Docker**: `curl http://localhost:5173/api/metrics/facets` → `200` con el
  JSON real del backend. Esto confirma que `http://backend:8000` (el target del proxy en
  `frontend/vite.config.ts`) sí resuelve dentro de la red de Docker Compose, tal como afirma el
  README ("no extra environment variables required in local development"). La limitación documentada
  más abajo (`ENOTFOUND backend`) solo aplica fuera de Docker, como ya se indicaba.
- `docker compose exec backend python -m pytest -q` → **15/15 passed** dentro del contenedor real.
- `docker compose exec frontend npx vitest run` → **6/6 passed** dentro del contenedor real.
- `docker compose down` → limpieza correcta, sin contenedores/red huérfanos.

**Conclusión**: todas las afirmaciones del README sobre `docker compose up --build` (puertos, ausencia
de variables de entorno necesarias, proxy `/api`) quedan ✅ VERIFICADAS con el mecanismo real, no solo
por inspección de configuración. No se encontró ninguna discrepancia entre lo documentado en
`README.md`/`README.es.md` y el comportamiento real — no hizo falta ninguna corrección de
documentación bilingüe (`.agents/rules/documentation.md`).

## No verificable / fuera de alcance (verificación inicial, antes de instalar Docker)

- En la verificación inicial no se pudo comprobar el flujo vía `docker compose up --build` porque
  Docker no estaba instalado en el entorno (el intento inicial de Docker Desktop falló por
  "Virtualization support not detected" — VT-x desactivado en la BIOS del portátil; se resolvió
  activándolo en la BIOS e instalando WSL2). Ver la sección "Verificación con Docker" arriba para el
  resultado real una vez resuelto.

## Rule validation

**Task:**
Corregir el hallazgo #4 de `engineering-findings.md`: el header del dashboard mostraba el periodo
hardcodeado `"2024 — Full Year"`, que ya no coincide con el rango de datos real (relativo a la fecha
del sistema). Tarea real, pequeña, y ya identificada como inconsistencia verificada en Fase 1/2 — no
un cambio inventado solo para "demostrar" las reglas.

**Rules applied (razonadas antes de tocar código):**
- `.agents/rules/frontend.md`: "Si se necesita mostrar el periodo de datos en la UI, derivarlo de la
  API (`/api/metrics/facets`) en vez de un string fijo."
- `.agents/rules/architecture.md`: los tipos que reflejan la forma cruda de la API deben mantenerse en
  snake_case, igual que el modelo Pydantic correspondiente.
- `.agents/rules/testing.md`: cualquier función nueva con lógica no trivial necesita test; ejecutar
  lint/tests antes de dar por terminado.
- `.agents/rules/backend.md`: confirmó que no había que tocar el backend (el endpoint `/api/metrics/facets`
  ya existe y ya está testeado en `backend/tests/test_routes.py`).

**Cambios realizados:**
- `frontend/src/lib/financial-types.ts`: nuevo tipo `MetricsFacets` en snake_case
  (`min_date`/`max_date`, no `minDate`/`maxDate`) — decisión directamente dictada por
  `architecture.md`, no por convención habitual de TypeScript.
- `frontend/src/lib/financial-utils.ts`: nueva función `formatPeriodLabel(minDate, maxDate)`.
- `frontend/src/lib/financial-utils.test.ts`: test nuevo para `formatPeriodLabel`, usando fechas con
  el mismo formato ISO que devuelve la API real.
- `frontend/src/App.tsx`: ahora hace `Promise.all` de `/api/metrics` y `/api/metrics/facets`, calcula
  el periodo real y lo pasa a `DashboardHeader`.
- `frontend/src/components/dashboard/dashboard-header.tsx`: se elimina el valor por defecto
  hardcodeado (`period` pasa a ser prop obligatoria) para no dejar un segundo lugar con el año fijo.

**Evidence:**
- `npx tsc -b` → exit 0 (sin errores de tipos).
- `npx eslint .` → sin salida (0 errores).
- `npx vitest run` → 6 passed (5 previos + el nuevo test de `formatPeriodLabel`).
- `curl http://127.0.0.1:8000/api/metrics/facets` (backend nativo) →
  `{"min_date":"2025-09-02","max_date":"2026-08-28", ...}`, confirmando que el nuevo código consume
  la forma real de la respuesta.
- Backend `pytest` (15 tests, sin tocar) sigue en verde: el cambio no tocó `backend/`.

**Result:**
Las reglas dirigieron el cambio de forma concreta: sin `frontend.md` habría sido igual de fácil
hardcodear un año distinto; sin `architecture.md` el tipo nuevo probablemente se habría escrito en
camelCase (`minDate`/`maxDate`), rompiendo el parseo del JSON real. No se detectaron reglas ambiguas
o inútiles en esta validación — las cuatro reglas consultadas aportaron una instrucción accionable
distinta y verificable.

**Adjustments:**
Ninguno. No hizo falta reescribir ninguna regla tras la validación.

**Limitación de esta validación:**
No se pudo confirmar el resultado visualmente en un navegador: este entorno no tiene acceso de red
para descargar un binario de Chromium (Playwright: `Download failure` / timeout al descargar
`chrome-win64.zip`). La verificación se apoyó en typecheck, lint, tests unitarios (con fechas en el
formato real de la API) y una llamada `curl` directa al endpoint real — no en una captura de pantalla
del dashboard renderizado.

## Rule validation #2

**Task:**
Al reinvestigar `backend.md` para comprobar que aplicaba a un caso real, se detectó un bug genuino
(no buscado deliberadamente para "demostrar" la regla): `test_metrics_comparison_returns_delta_fields`
usaba fechas fijas (`2025-03-01`/`2025-03-31`) que ya no coincidían con el rango de datos real
generado por `generate_mock_movements` (`2025-09-02` a `2026-08-28` en el momento de esta
verificación). El endpoint devolvía resultados vacíos (`current_period: 0.0`) y el test seguía en
verde porque solo comprobaba las claves del JSON, no los valores — un falso positivo real, no
hipotético. Ver hallazgo #10 en `engineering-findings.md`.

**Rules applied:**
- `.agents/rules/backend.md`: "los datos generados son relativos a la fecha del sistema" — explica la
  causa raíz exacta del bug, y ya incluía la instrucción de no asumir fechas fijas al trabajar con el
  dataset generado.
- `.agents/rules/testing.md`: ejecutar `pytest` para confirmar el estado antes/después del cambio.

**Evidence:**
- Antes de corregir: `curl "/api/metrics/comparison?start_date=2025-03-01&end_date=2025-03-31"` →
  `{"current_period":0.0,"previous_period":0.0,"delta_abs":0.0,"delta_pct":null}` (datos vacíos,
  bug confirmado).
- `curl "/api/metrics/facets"` → `"min_date":"2025-09-02","max_date":"2026-08-28"` (marzo 2025 fuera
  de rango).
- Corrección: `backend/tests/test_routes.py` ahora deriva el rango de fechas de
  `/api/metrics/facets` en vez de usar fechas fijas, y añade
  `assert payload["current_period"] != 0 or payload["previous_period"] != 0` para que el test no
  pueda volver a pasar silenciosamente con datos vacíos.
- Tras el fix: `curl "/api/metrics/comparison?start_date=2025-10-02&end_date=2025-11-01"` →
  `{"current_period":51431.48,"previous_period":-9371.66,"delta_abs":60803.14,"delta_pct":648.8}`
  (datos reales, no degenerados).
- `pytest` → **15/15 passed** tras el cambio.

**Result:**
La regla `backend.md` dirigió tanto el diagnóstico (identificar por qué el test daba datos vacíos)
como la corrección (derivar fechas del dataset real en vez de hardcodearlas). Sin la regla ya escrita
explicando la naturaleza relativa de los datos, el diagnóstico habría requerido releer
`_year_for_month` desde cero.

**Adjustments:**
Se amplió `backend.md` con una instrucción accionable explícita sobre no usar fechas absolutas en
tests nuevos que filtren por fecha, citando este bug como precedente concreto.
