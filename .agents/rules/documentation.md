# Documentation rules

## Nombre
Sincronización de documentación bilingüe y ubicación del contexto para agentes.

## Alcance
Cambios a `README.md`, `README.es.md`, `AGENTS.md`, o cualquier instrucción de ejecución/estructura
del proyecto (puertos, comandos, variables de entorno) que deba reflejarse en la documentación.

## Justificación
El repositorio mantiene `README.md` (inglés) y `README.es.md` (español) con la misma estructura de
secciones, los mismos comandos y los mismos puertos, traducidos en paralelo. El historial de commits
del repositorio confirma que se tratan como documentos sincronizados (existe un commit dedicado
exclusivamente a corregir un enlace en la versión en español). `AGENTS.md` es, además, el punto de
entrada explícito que le dice a cualquier agente dónde buscar reglas y memoria del proyecto.

## Evidencia
- `README.md:39-50` y `README.es.md:39-50` (mismas secciones "How to run locally"/"Cómo ejecutar en
  local", mismos comandos y puertos)
- Commit `f0812fa` ("Update Spanish README with corrected link...") en el historial de git
- `AGENTS.md:1-15` (indica explícitamente revisar `.agents/rules`, `.agents/skills` y `memory-bank`
  antes de actuar)

## Instrucción accionable
- Si se cambia un comando, puerto, variable de entorno o paso de ejecución en `README.md`, replicar
  el cambio equivalente en `README.es.md` en el mismo cambio (no en un commit posterior).
- Si se añade nueva documentación operativa para agentes (reglas, memoria, skills), mantenerla dentro
  de `.agents/rules/`, `.agents/skills/` o `memory-bank/`, tal como indica `AGENTS.md`, en vez de
  crear ubicaciones nuevas no referenciadas desde `AGENTS.md`.

## Qué evitar
- No actualizar `README.md` sin revisar si `README.es.md` necesita el mismo cambio (o viceversa):
  dejarlos desincronizados contradice la convención ya establecida en el repositorio.
- No documentar afirmaciones sobre el proyecto (puertos, comandos, servicios) sin verificarlas contra
  el código/configuración real — ver `verification.md` para ejemplos de afirmaciones que resultaron
  incorrectas al comprobarlas.
