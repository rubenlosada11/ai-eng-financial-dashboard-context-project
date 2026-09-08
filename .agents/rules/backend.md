# Backend rules

## Nombre
Generación determinista de datos mock y endpoints sin base de datos.

## Alcance
Cambios en `backend/app/routes.py`, especialmente `generate_mock_movements`, `_build_movement`,
`_year_for_month`, o la adición/eliminación de endpoints bajo `/api/metrics*`.

## Justificación
No hay base de datos: todos los endpoints generan los movimientos financieros en memoria llamando a
`generate_mock_movements(seed=42)` de forma independiente en cada request. El seed y el volumen de
datos (12 meses × 30 movimientos) son valores exactos de los que dependen los tests existentes.
Además, las fechas generadas son relativas a `date.today()` (ventana móvil de 12 meses), no a un año
calendario fijo.

## Evidencia
- `backend/app/routes.py:94-104` (`generate_mock_movements`, bucle `range(1, 13)` × 30 movimientos)
- `backend/app/routes.py:65-68` (`_year_for_month`, cálculo relativo a `date.today()`)
- `backend/app/routes.py:248,264,277,295,311,343,350,362,378` (cada endpoint llama
  `generate_mock_movements(seed=42)` de forma independiente)
- `backend/tests/test_routes.py:12-16` (`assert len(movements) == 360`, orden cronológico)
- Confirmado ejecutando el backend el 2026-09-08: `/api/metrics` devolvió movimientos desde `2025-09`
  en adelante, no desde 2024 (ver `verification.md`)

## Instrucción accionable
- No modificar `seed=42`, el rango de meses (`range(1, 13)`) ni el número de movimientos por mes (30)
  sin actualizar `backend/tests/test_routes.py` en el mismo cambio.
- Si se necesita mostrar el rango real de fechas en el frontend, derivarlo de la respuesta de la API
  (`/api/metrics/facets` expone `min_date`/`max_date`), no asumir un año fijo.
- Antes de eliminar un endpoint de `backend/app/routes.py` por parecer no usado desde el frontend,
  comprobar si tiene tests en `backend/tests/test_routes.py`: si los tiene, es contrato soportado, no
  código muerto (el backend expone 9 endpoints pero el frontend solo consume `/api/metrics`).

## Qué evitar
- No introducir una base de datos, cache compartida entre requests, ni persistencia: el diseño actual
  es intencionalmente stateless/determinista por request.
- No asumir que los datos representan el año 2024: son relativos a la fecha de ejecución.
- No eliminar endpoints probados (`/facets`, `/summary`, `/categories/top`, `/comparison`, `/alerts`,
  `/b2b`, `/b2c`) solo porque el frontend actual no los llama.
