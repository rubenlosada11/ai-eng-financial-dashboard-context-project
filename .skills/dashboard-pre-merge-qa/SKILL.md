---
name: dashboard-pre-merge-qa
description: Úsala antes de abrir o mergear un PR que toque frontend/, backend/ o docker-compose.yml de este dashboard financiero, y siempre que añadas o cambies un gráfico, KPI o tarjeta. El repo no tiene CI y `npm run lint` + `npm run test` (lo que pide .agents/rules/testing.md) dejan pasar errores de tipos; esta skill fija la secuencia de QA exacta y los contratos de UI del dashboard.
---

# Dashboard: QA previo al merge

## Objetivo

Sustituir la ausencia de CI (no hay `.github/`, hooks ni plantilla de PR) por una comprobación reproducible que entregue un informe PASS/FAIL con la salida real de cada paso.

## Cuándo usar esta skill

- Antes de `git push` / abrir un PR con cambios en `frontend/`, `backend/`, `docker-compose.yml` o `frontend/package.json`.
- Al añadir o modificar un gráfico, KPI o tarjeta bajo `frontend/src/components/dashboard/`.
- No hace falta para cambios solo de documentación: basta `git diff` y mantener `README.md` y `README.es.md` sincronizados.

## Inputs

- Rama con los cambios (`git diff --stat main...HEAD`).
- Docker Desktop en marcha. Si el daemon está cerrado, `docker` falla con `dockerDesktopLinuxEngine ... not found`: arráncalo antes.
- Un navegador para el paso 6.

## Procedimiento

1. **Alcance.** `git diff --stat main...HEAD -- . ':!.claude/skills' ':!skills-lock.json'` (las skills instaladas entierran el diff real) y marca qué pasos aplican: `backend/` → 2; `frontend/` → 3; cambios en `Category`, `OperationType`, `BusinessType` o `FinancialMovement` → 4; componentes o CSS → 5 y 6.
2. **Backend.** `docker compose exec -T backend python -m pytest -q` (o `pytest` desde `backend/`). Obligatorio si cambió `backend/` o el contrato; si no, ejecútalo igual como referencia (tarda ~1 s). No borres ni reduzcas tests (`backend.md`).
3. **Frontend estático**, desde `frontend/`, los tres y en este orden: `npm run lint`, `npm run test`, `npm run build`. `build` es el **único** sitio donde corre `tsc -b` (no existe script `typecheck`; también tipa los `*.test.tsx`): un error de tipos sale con exit 0 en lint y vitest y solo falla en build (`error TS…`, exit 2). Compara los avisos del build con los de `main`; no debe reaparecer "Some chunks are larger than 500 kB".
4. **Contrato API.** Mismo cambio a la vez en `backend/app/routes.py` y `frontend/src/lib/financial-types.ts`; los tipos crudos de la API siguen en snake_case (`architecture.md`).
5. **Arranque real.** `docker compose up --build -d`. Si cambió `frontend/package.json`, añade `--renew-anon-volumes` (Compose reutiliza el volumen anónimo `/app/node_modules`). Tras editar fuentes del frontend en Windows, `docker compose restart frontend`: el bind mount no propaga los eventos y Vite sigue sirviendo el módulo viejo (compruébalo con `curl http://localhost:5173/src/<archivo>`). Esperado: `:8000/health`, `:5173/` y `:5173/api/metrics/facets` → 200.
6. **Contratos de UI** (si tocaste `frontend/src/components/dashboard/` o `App.tsx`):
   - Los gráficos entran por `lazy()` en `App.tsx`, dentro de `ChartsErrorBoundary` y `Suspense fallback={<ChartSkeleton />}`. Comprobación: `grep -rlE "from ['\"]recharts['\"]" frontend/src --include=*.ts --include=*.tsx` debe listar solo `income-outcome-chart.tsx` y `profit-percent-chart.tsx`; si lista 0 archivos, el comando está mal, no el código.
   - Cada gráfico: título en `<h2>` dentro de `CardTitle`, `aria-label` en el `LineChart`, `ChartDataTable` con los mismos datos, `role="status"` en la raíz del tooltip propio.
   - Carga → región `role="status"`; fallo de API → `role="alert"`; texto en español → `lang="es"`.
   - Periodos y rangos salen de `/api/metrics/facets`, nunca un año fijo (`frontend.md`).
   - Tests colocados `*.test.tsx` con consultas por rol y fechas a mitad de mes (evita saltos de zona horaria).
7. **Navegador** (el repo no tiene herramienta e2e: hazlo a mano con DevTools) en `http://localhost:5173` a 1440 px y a 375 px: 2 gráficos dibujados, consola sin errores, `Tab` llega a ambos gráficos con foco visible, `ArrowRight` mueve el tooltip, sin scroll horizontal, y el periodo de la cabecera coincide con `min_date`–`max_date` de `/api/metrics/facets`.
8. **Docs.** Si cambió un comando, puerto o variable: `README.md` y `README.es.md` en el mismo cambio (`documentation.md`). Revisa también `.agents/rules/*.md` y `memory-bank/` en busca de hechos que tu cambio dejó obsoletos (nº de tests, "no hay tests de componentes", comandos exigidos antes de terminar).

## Output esperado

Tabla `Paso | Comando o comprobación | PASS/FAIL/N/A | Evidencia` y, debajo, los problemas nuevos separados de los preexistentes. Sin "todo OK" sin salida real pegada.

## Criterios de aceptación

- Todos los pasos aplicables en PASS; `pytest`, `vitest` y `build` con exit 0.
- El número de tests no baja respecto a `main`.
- El build no añade avisos nuevos y `recharts` sigue fuera del chunk de entrada.
- Preexistentes conocidos, no atribuibles al cambio: 2 `DeprecationWarning` de starlette en pytest y las vulnerabilidades de `npm audit`; compara el recuento con `main` en vez de darlo por bueno.

## Verificación

Prueba de humo de la propia skill: crea `frontend/src/lib/x.ts` con `export const n: number = "a"`. Lint y test deben seguir en exit 0 y el paso 3 debe marcar FAIL en `build` con `TS2322`. Borra el archivo. Si el informe marcó PASS, la skill no se aplicó bien.

## Errores frecuentes

- Dar por bueno `lint` + `test` sin ejecutar `build`.
- Mirar `localhost:5173` sin reiniciar `frontend` tras editar fuentes, y validar código viejo.
- Reconstruir tras cambiar `package.json` sin `--renew-anon-volumes` y ver dependencias ausentes en el contenedor.
- Importar `recharts` desde `App.tsx` o un componente de la entrada y anular la división de chunks.
- Añadir un gráfico sin `ChartDataTable`, `aria-label` o `role="status"` en su tooltip.
- Fechas absolutas en tests o en la UI (los datos de la API son una ventana móvil de 12 meses).
- Ejecutar `npm` desde la raíz: no hay `package.json` en ella, van desde `frontend/`.
