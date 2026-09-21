# Testing rules

## Nombre
Ejecución manual de tests/lint (sin CI) y tests como señal de contrato soportado.

## Alcance
Cualquier cambio en `backend/app/routes.py`, `backend/tests/`, `frontend/src/lib/`, o cualquier
cambio que se vaya a dar por terminado.

## Justificación
No existe carpeta `.github/workflows` ni ninguna otra configuración de CI en el repositorio. Tampoco
hay `pyproject.toml`/`pytest.ini` ni pre-commit hooks. Los tests (`pytest` en backend, `vitest` en
frontend) y el lint (`eslint`) solo se ejecutan si alguien —persona o agente— los invoca
manualmente. Además, los tests existentes son la única señal fiable de qué comportamiento del
backend está soportado, incluso si el frontend no lo consume todavía.

## Evidencia
- Ausencia de `.github/` en la raíz del repositorio (comprobado)
- `backend/requirements.txt` incluye `pytest`, `pytest-cov`, `httpx` pero sin configuración de
  invocación automática
- `frontend/package.json:9-14` (scripts `lint`, `test`, `test:watch`, `test:coverage`)
- `backend/tests/test_routes.py` (15 tests) cubre los 9 endpoints, incluidos los que el frontend no
  llama todavía (`/facets`, `/summary`, `/categories/top`, `/comparison`, `/alerts`, `/b2b`, `/b2c`)
- `frontend/src/lib/financial-utils.test.ts` cubre las funciones puras de `financial-utils.ts`; los
  componentes y `App.tsx` tienen tests colocados `*.test.tsx` (Vitest + Testing Library + jsdom, ver
  `memory-bank/progress.md`)
- `frontend/package.json:9-14`: no existe script `typecheck`; `tsc -b` solo corre dentro de
  `npm run build` (también tipa los `*.test.tsx`). Con un error de tipos, `npm run lint` y `npm run test`
  salen con exit 0 y solo falla `npm run build` (comprobado el 2026-09-21)

## Instrucción accionable
- Antes de dar por terminado cualquier cambio de backend, ejecutar `pytest` desde `backend/`
  (con las dependencias de `requirements.txt` instaladas).
- Antes de dar por terminado cualquier cambio de frontend, ejecutar `npm run lint`, `npm run test` **y
  `npm run build`** desde `frontend/` (el build es el único typecheck). Para el flujo completo previo a un
  PR, seguir `.skills/dashboard-pre-merge-qa/SKILL.md`.
- Si se añade un endpoint o función nueva con lógica no trivial (filtrado, agregación, cálculo),
  añadir su test correspondiente en `backend/tests/test_routes.py` o
  `frontend/src/lib/*.test.ts`, siguiendo el estilo ya usado (nombres de test descriptivos en
  inglés, aserciones sobre la respuesta HTTP completa en backend).
- Antes de considerar un endpoint del backend como "no usado" y candidato a eliminar, comprobar si
  tiene tests: si los tiene, mantenerlo (ver `.agents/rules/backend.md`).

## Qué evitar
- No asumir que hay un pipeline de CI que valida los cambios: no existe. La responsabilidad de
  ejecutar tests/lint recae en quien hace el cambio.
- No añadir componentes React con lógica (formateo, cálculo condicional) sin verificar si ya hay
  cobertura equivalente: la lógica de negocio vive en `financial-utils.ts` (test en
  `financial-utils.test.ts`) y los componentes se testean con consultas por rol en `*.test.tsx`
  colocados junto al componente. jsdom no dibuja Recharts (sin layout): el dibujo y el teclado de los
  gráficos se verifican en un navegador real.
- No dar por verificado un cambio de frontend con solo `lint` + `test`.
