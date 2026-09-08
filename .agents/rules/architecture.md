# Architecture rules

## Nombre
Contrato de datos backend↔frontend y patrones de acceso a la API.

## Alcance
Cambios que añaden/modifican campos del modelo `FinancialMovement`, tipos cerrados
(`Category`, `OperationType`, `BusinessType`), o que añaden lógica de filtrado/nuevos endpoints.

## Justificación
El backend (`backend/app/routes.py`) y el frontend (`frontend/src/lib/financial-types.ts`) definen
el mismo contrato de datos de forma independiente, en dos lenguajes, sin generación automática de
tipos ni capa de mapeo entre API y UI. Cualquier divergencia entre ambos archivos rompe el parseo
en runtime sin que TypeScript lo detecte en tiempo de compilación.

## Evidencia
- `backend/app/routes.py:11-27` (`OperationType`, `Category`, `BusinessType`, `FinancialMovement`)
- `frontend/src/lib/financial-types.ts:1-11` (mismos campos, snake_case, sin transformar)
- `backend/app/routes.py:107-143` (`filter_movements_by_date`, `filter_movements`), reutilizadas por
  los 6 endpoints que filtran movimientos (líneas 256-257, 281-283, 299-301, 316-317, 324-325,
  355-356, 372-373, 388-389)

## Instrucción accionable
- Los tipos que reflejan la forma cruda de la API (`FinancialMovement` en
  `frontend/src/lib/financial-types.ts`) deben mantenerse en snake_case, idéntico a los modelos
  Pydantic de `backend/app/routes.py`. No convertir a camelCase.
- Los tipos calculados/derivados en el frontend (`KPIMetrics`, `MonthlyDataPoint`) sí usan camelCase
  porque no vienen directamente de la API — mantener esa distinción.
- Cualquier cambio a categorías, tipos de operación o tipos de negocio debe aplicarse a la vez en
  `backend/app/routes.py` (el `Literal` correspondiente, y `OUTCOME_CATEGORIES` si afecta a
  categorías de gasto) y en `frontend/src/lib/financial-types.ts`.
- Nuevos endpoints que filtren movimientos por fecha, categoría o tipo de operación deben reusar
  `filter_movements` / `filter_movements_by_date`, no reimplementar el filtrado inline.

## Qué evitar
- No "normalizar" los campos de `FinancialMovement` en el frontend a camelCase: rompe el parseo del
  JSON real devuelto por `/api/metrics` y endpoints relacionados.
- No añadir una categoría/tipo solo en un lado del contrato (backend o frontend) sin el otro.
- No dar por hecho que un endpoint sin caller en el frontend es código muerto — ver
  `.agents/rules/backend.md` y `.agents/rules/testing.md`.
