# Product overview

## Qué es

Un dashboard de métricas financieras: frontend en React + TypeScript que muestra KPIs y gráficos a
partir de movimientos financieros (ingresos/gastos) servidos por una API FastAPI.
Evidencia: `README.md:18` ("Financial metrics dashboard with a React + TypeScript frontend and a
FastAPI backend"), `backend/app/main.py:6` (`FastAPI(title="Financial Metrics API")`).

Es un proyecto educativo de 4Geeks Academy, no un sistema financiero en producción: los datos no
provienen de ningún libro contable real, sino que se generan en memoria de forma simulada y
determinista en cada request (`backend/app/routes.py:94-104`, `generate_mock_movements(seed=42)`).
Evidencia del origen educativo: `README.md:54` ("built by students as part of the Career Programs at
4Geeks Academy").

## Modelo de datos

Cada "movimiento financiero" (`FinancialMovement`) tiene: fecha (`create_date`), importe (`amount`),
tipo de operación (`income` | `outcome`), categoría (`suppliers` | `sales` | `operational` |
`administrative` | `others`) y tipo de negocio (`B2B` | `B2C`).
Evidencia: `backend/app/routes.py:11-27`, replicado en `frontend/src/lib/financial-types.ts:1-11`.

## Capacidades principales

Actualmente en uso por la UI (verificado ejecutando el proyecto):
- KPIs agregados: ingreso total, gasto total, beneficio, margen de beneficio (%).
  Evidencia: `frontend/src/components/dashboard/kpi-row.tsx`.
- Dos gráficos de líneas mensuales: Income vs. Outcome, y Profit Margin %.
  Evidencia: `frontend/src/components/dashboard/income-outcome-chart.tsx`,
  `frontend/src/components/dashboard/profit-percent-chart.tsx`.
- Periodo mostrado en la cabecera, calculado dinámicamente a partir del rango real de datos
  (`/api/metrics/facets`), no un año fijo.
  Evidencia: `frontend/src/App.tsx`, ver `verification.md` sección "Rule validation".

Expuesto por el backend pero **sin consumir aún desde la UI** (funcionalidad real, con tests, no
código muerto — ver `engineering-findings.md` hallazgo #6):
- Resumen agregado por día/semana/mes (`/api/metrics/summary`), con filtro opcional por tipo de negocio.
- Categorías top por importe (`/api/metrics/categories/top`).
- Comparación entre periodos (`/api/metrics/comparison`).
- Alertas de anomalías por incremento de gasto (`/api/metrics/alerts`).
- Listados filtrados solo B2B / solo B2C (`/api/metrics/b2b`, `/api/metrics/b2c`).

Evidencia de los 9 endpoints totales: `backend/app/routes.py:243-391`, todos probados en
`backend/tests/test_routes.py` (15 tests).

## Flujo principal

1. El frontend hace `GET /api/metrics` y `GET /api/metrics/facets` al montar la página.
2. Calcula KPIs y agregados mensuales en el cliente (`frontend/src/lib/financial-utils.ts`).
3. Renderiza la cabecera, la fila de KPIs y los dos gráficos.

Evidencia: `frontend/src/App.tsx`.

## Usuarios / autenticación

No existe ningún sistema de autenticación ni de usuarios en el repositorio (sin dependencias de auth,
sin middleware, sin rutas protegidas; CORS abierto a cualquier origen en
`backend/app/main.py:7-13`). No se documentan actores/roles porque no hay evidencia de negocio real
detrás del dato — inventar personas de usuario aquí sería especulación no respaldada.
