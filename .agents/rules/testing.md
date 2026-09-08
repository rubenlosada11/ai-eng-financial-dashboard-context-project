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
- `frontend/src/lib/financial-utils.test.ts` (5 tests) cubre únicamente funciones puras de
  `financial-utils.ts`; no hay tests de componentes React

## Instrucción accionable
- Antes de dar por terminado cualquier cambio de backend, ejecutar `pytest` desde `backend/`
  (con las dependencias de `requirements.txt` instaladas).
- Antes de dar por terminado cualquier cambio de frontend, ejecutar `npm run lint` y
  `npm run test` desde `frontend/`.
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
  cobertura equivalente en `financial-utils.test.ts`, que es donde vive la lógica de negocio del
  frontend actualmente.
