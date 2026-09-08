# Engineering findings

Hallazgos derivados de inspeccionar y ejecutar el repositorio (no son buenas prácticas genéricas: cada uno
está anclado a un archivo concreto). Sirven de base para las reglas en `.agents/rules/`.

---

### 1. El contrato de datos backend↔frontend usa snake_case sin transformar

**Hallazgo:**
Los campos del modelo `FinancialMovement` del backend (`create_date`, `operation_type`, `business_type`)
se replican en snake_case, literalmente igual, en el tipo TypeScript del frontend. No hay una capa que
convierta a camelCase.

**Evidencia:**
`backend/app/routes.py:22-27` (clase `FinancialMovement`)
`frontend/src/lib/financial-types.ts:5-11` (interfaz `FinancialMovement`)

**Implicación:**
Un agente que "normalice" el frontend a camelCase (convención habitual en TS/React) rompería el parseo del
JSON real devuelto por `/api/metrics`, porque no existe ninguna capa de mapeo entre API y UI.

**Regla candidata:**
Los tipos que reflejan la forma cruda de la API (`FinancialMovement`) deben mantenerse en snake_case,
idéntico a los modelos Pydantic del backend. Los tipos derivados/calculados en el frontend
(`KPIMetrics`, `MonthlyDataPoint`) sí usan camelCase porque no vienen directamente de la API — ver
`frontend/src/lib/financial-types.ts:13-25` y `frontend/src/lib/financial-utils.ts:21-34`.

---

### 2. `Category` y `OperationType` son tipos cerrados duplicados en dos lenguajes

**Hallazgo:**
Las categorías (`suppliers`, `sales`, `operational`, `administrative`, `others`) y tipos de operación
(`income`, `outcome`) están definidos como `Literal` en Python y como union de strings en TypeScript, de
forma independiente y sin generación automática de tipos.

**Evidencia:**
`backend/app/routes.py:11-14` (`OperationType`, `Category`, `BusinessType`)
`frontend/src/lib/financial-types.ts:1-3`

**Implicación:**
Añadir o renombrar una categoría en el backend sin replicar el cambio en `financial-types.ts` deja al
frontend con un tipo desincronizado del contrato real (no habría error de compilación TS, solo un
`string` no tipado llegando en runtime).

**Regla candidata:**
Cualquier cambio a las categorías, tipos de operación o tipos de negocio debe aplicarse simultáneamente en
`backend/app/routes.py` (Literal + `OUTCOME_CATEGORIES` si aplica) y en
`frontend/src/lib/financial-types.ts`.

---

### 3. Todos los endpoints regeneran el dataset con `seed=42`, y los tests dependen de ese valor exacto

**Hallazgo:**
Cada endpoint de `backend/app/routes.py` llama a `generate_mock_movements(seed=42)` de forma
independiente (no hay dataset compartido/cacheado). El test
`test_generate_mock_movements_returns_full_year_sorted_data` asume exactamente 360 movimientos
(12 meses × 30) y orden cronológico.

**Evidencia:**
`backend/app/routes.py:248,264,277,295,311,343,350,362,378` (llamadas a `generate_mock_movements(seed=42)`)
`backend/tests/test_routes.py:12-16` (`assert len(movements) == 360`)

**Implicación:**
Cambiar el `seed`, el número de movimientos por mes (30) o el rango de meses (`range(1, 13)`) rompe
silenciosamente los tests existentes, ya que dependen del valor exacto de longitud y del orden.

**Regla candidata:**
No modificar `seed=42` ni el volumen de datos generado (`range(1, 13)` × 30 movimientos/mes) sin
actualizar `backend/tests/test_routes.py` en el mismo cambio.

---

### 4. Los datos generados son relativos a la fecha del sistema, no a un año fijo

**Hallazgo:**
`_year_for_month` calcula el año de cada movimiento en función de `date.today()`: los meses anteriores al
mes actual usan el año en curso, los posteriores usan el año anterior. Esto produce una ventana móvil de
12 meses, no un año calendario fijo.

**Evidencia:**
`backend/app/routes.py:65-68` (`_year_for_month`)
Confirmado ejecutando el backend el 2026-09-08: `/api/metrics` devolvió movimientos desde `2025-09`.

**Implicación:**
El frontend muestra un label estático `"2024 — Full Year"` en la cabecera
(`frontend/src/App.tsx:49`, `frontend/src/components/dashboard/dashboard-header.tsx:7`) que ya no
corresponde al rango real de datos. Un agente que "corrija" el label a un año fijo distinto seguiría
estando desincronizado, porque el rango es dinámico por diseño del backend.

**Regla candidata:**
No hardcodear años/periodos en el frontend que describan el rango de datos: si se necesita mostrar el
periodo real, debe derivarse de la respuesta de la API (p. ej. `/api/metrics/facets`, que expone
`min_date`/`max_date`), no de un string fijo.

---

### 5. El filtrado de movimientos está centralizado en dos funciones puras reutilizadas por todos los endpoints

**Hallazgo:**
`filter_movements_by_date` y `filter_movements` son las únicas funciones de filtrado y las usan los 6
endpoints de listado/summary. Ningún endpoint implementa su propio filtrado inline.

**Evidencia:**
`backend/app/routes.py:107-143` (definición)
`backend/app/routes.py:256-257,281-283,299-301,316-317,324-325,355-356,372-373,388-389` (uso)

**Implicación:**
Un agente que añada un nuevo endpoint con filtros de fecha/categoría/tipo de operación y reimplemente el
filtrado inline (en vez de reusar estas funciones) introduciría un segundo camino de lógica que puede
divergir sutilmente (p. ej. límites inclusivos/exclusivos).

**Regla candidata:**
Nuevos endpoints que filtren movimientos por fecha/categoría/tipo de operación deben reusar
`filter_movements` / `filter_movements_by_date`, no reimplementar el filtrado.

---

### 6. El frontend solo consume 1 de los 9 endpoints existentes

**Hallazgo:**
`backend/app/routes.py` expone `/health` y 8 endpoints bajo `/api/metrics*`
(`/api/metrics`, `/facets`, `/summary`, `/categories/top`, `/comparison`, `/alerts`, `/b2b`, `/b2c`).
El único fetch en todo `frontend/src` es a `/api/metrics`.

**Evidencia:**
`frontend/src/App.tsx:16` (única llamada `fetch`)
`backend/app/routes.py:243-391` (definición de los 9 endpoints)

**Implicación:**
Un agente podría asumir erróneamente que endpoints como `/api/metrics/summary` o `/api/metrics/alerts`
están "muertos" o sin usar y eliminarlos; en realidad son funcionalidad de backend ya probada
(`backend/tests/test_routes.py`) pero pendiente de integrar en la UI, no código huérfano a limpiar.

**Regla candidata:**
No eliminar endpoints de `backend/app/routes.py` por parecer "no usados" desde el frontend: verificar
primero si tienen tests en `backend/tests/test_routes.py` (indicando que son contrato soportado) antes de
tratarlos como código muerto.

---

### 7. `frontend/src/lib/mock-data.ts` no se importa en ningún lugar

**Hallazgo:**
El archivo define 60 movimientos de ejemplo con año fijo 2024, pero no hay ningún `import` que lo
referencie en el resto del proyecto (`grep -r "mock-data" frontend/src` no devuelve resultados salvo el
propio archivo).

**Evidencia:**
`frontend/src/lib/mock-data.ts` (archivo completo)
Búsqueda `grep` en `frontend/src` sin coincidencias de importación.

**Implicación:**
Es código huérfano. Un agente podría asumir que es la fuente de datos de desarrollo/fallback y empezar a
mantenerlo o "conectarlo", cuando en realidad `App.tsx` siempre depende del backend real.

**Regla candidata:**
No asumir que `mock-data.ts` es la fuente de datos activa del dashboard. Si se necesita reactivar como
fixture (tests, Storybook, modo offline), debe importarse explícitamente y documentarse por qué.

---

### 8. El proxy de Vite apunta al hostname de Docker Compose, no a `localhost`

**Hallazgo:**
`vite.config.ts` reenvía `/api` a `http://backend:8000`, donde `backend` es el nombre de servicio definido
en `docker-compose.yml`. Ese hostname solo resuelve dentro de la red de Docker Compose.

**Evidencia:**
`frontend/vite.config.ts:11-16`
`docker-compose.yml:14` (servicio `backend`)
Confirmado ejecutando frontend y backend nativamente (sin Docker): `Error: getaddrinfo ENOTFOUND backend`
(ver `verification.md`).

**Implicación:**
Un agente que intente ejecutar/depurar el frontend fuera de Docker (p. ej. `npm run dev` en el host, con
el backend en `localhost:8000`) verá fallar todas las peticiones `/api/*` a menos que fije
`VITE_API_BASE_URL` apuntando directamente al backend.

**Regla candidata:**
Al ejecutar servicios fuera de `docker compose`, establecer `VITE_API_BASE_URL=http://localhost:8000` (o
el host real del backend) en `frontend/.env`; no asumir que el proxy de Vite funcionará sin Docker.

---

### 9. No existe CI ni configuración de linters/tests a nivel de repositorio

**Hallazgo:**
No hay carpeta `.github/workflows`, ni `pyproject.toml`/`pytest.ini`, ni pre-commit hooks. Los tests
(`pytest`, `vitest`) y el lint (`eslint`) solo se ejecutan manualmente vía los comandos declarados en
`backend/requirements.txt`/`frontend/package.json`.

**Evidencia:**
Ausencia de `.github/` en la raíz del repositorio (comprobado).
`frontend/package.json:9-14` (scripts `lint`, `test`, `test:coverage`)
`backend/requirements.txt` (incluye `pytest`, `pytest-cov` pero sin config de invocación automática)

**Implicación:**
Nada bloquea automáticamente un PR con tests rotos o lint fallido; el propio agente es la única línea de
defensa antes de hacer commit/push.

**Regla candidata:**
Antes de dar por terminado cualquier cambio, ejecutar manualmente `pytest` (desde `backend/`) y
`npm run lint` + `npm run test` (desde `frontend/`), ya que no hay CI que lo haga por el agente.

---

## Riesgos adicionales (sin regla dedicada, solo a documentar)

- **CORS abierto**: `backend/app/main.py:7-13` permite cualquier origen (`allow_origins=["*"]`). Aceptable
  para un proyecto educativo sin autenticación, pero un riesgo si se despliega tal cual en producción.
- **Sin autenticación**: no existe ningún mecanismo de auth en el repositorio (ni dependencias, ni
  middleware, ni rutas protegidas). No inventar un sistema de auth inexistente al documentar el proyecto.
- **`.venv-verify/` (backend)**: directorio creado durante esta verificación para instalar dependencias
  sin Docker; Python genera su propio `.gitignore` interno (`*`) por lo que git ya lo ignora
  automáticamente. No requiere entrada manual en `.gitignore`.
