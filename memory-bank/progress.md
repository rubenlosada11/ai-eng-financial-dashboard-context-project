# Progress — mejora con agent skills (2026-09-21)

Rama `feature/agent-skills`, sobre `main` @ `4a39170`. Práctica: mejorar el dashboard con skills de
agentes, verificando cada cambio contra evidencia real. Todo lo que aparece como "pasa" se ejecutó el
2026-09-21 (Docker Desktop, Node 24, Python 3.13 en contenedor, Microsoft Edge headless vía
`playwright-core` instalado **fuera** del repo).

## Baseline (antes de cualquier cambio, `main`)

| Comprobación | Resultado |
|---|---|
| `docker compose up --build` | backend `:8000`/`:5678`, frontend `:5173`; `/health`, `/`, `/api/metrics/facets` → 200; 360 movimientos |
| `pytest` (contenedor) | 15/15, **2 `DeprecationWarning` de starlette (preexistentes)** |
| `npm run lint` / `npm run test` | exit 0 / 6/6 |
| `npm run build` | OK; 1 chunk de 584 kB (175 kB gzip) con el aviso **preexistente** "chunks larger than 500 kB" |
| `npm ci` | **12 vulnerabilidades preexistentes** (1 low, 5 moderate, 6 high) |
| Navegador (Edge) | 2 gráficos y 4 KPIs renderizan; 0 errores de consola; axe-core **0 violaciones**, 24 nodos de contraste "incompletos" (calculados a mano: todo el texto ≥ 5.17:1) |
| Accesibilidad detectada | gráficos `role=application` enfocables **sin nombre**; tooltip sin `role=status` (0 live regions); sin encabezados `h2`; error sin `role=alert`; `<title>frontend</title>` |

## Skills obligatorias

### `accessibility` — `addyosmani/web-quality-skills` (WCAG 2.2)

- Descubierta con `npx skills find accessibility` (19 resultados). Elegida por: nombre exacto, específica
  de web (la de `affaan-m/ecc` mezcla iOS/Android; la de `microsoft/vscode` es de VS Code) y flujo
  "evidence-led" (axe + árbol de accesibilidad + teclado).
- **Auditado**: árbol ARIA, orden de Tab, foco, contraste (calculado desde los tokens `oklch`), axe-core,
  estados de carga/error, movimiento reducido.
- **Modificado** (commit `fix: apply accessibility agent skill improvements`): `aria-label` + tabla `sr-only`
  (`chart-data-table.tsx`, nuevo) en cada gráfico; `role="status"` en los tooltips propios (Recharts pierde
  el suyo al usar `content` personalizado); `<h2>` en los títulos de gráfico; `role="alert"` + `lang="es"` en el
  error; región `role="status"` de carga; `<title>Financial Overview</title>`; bloque `prefers-reduced-motion`.
- **Verificado**: árbol ARIA (gráficos con nombre, `heading` nivel 2, tabla de 12 filas), `ArrowRight` →
  live region, error con API 500, estado de carga con API retrasada, `reducedMotion` (skeleton 2 s → 1e-05 s),
  axe 0 → 0 violaciones, captura idéntica al baseline. **No se añadió ARIA decorativa**; revisado y sin cambios:
  iconos (`aria-hidden` ya presente), foco visible, contraste, sin `img`/formularios/botones.

### `vercel-react-best-practices` — `vercel-labs/agent-skills`

- Descubierta con `npx skills find vercel-react-best-practices` (19 resultados; el resto son copias/forks con
  <400 instalaciones frente a 732K de la oficial).
- **Auditado** contra el stack real (SPA Vite + React 19; las reglas `server-*`, RSC, hidratación y Next.js
  **no aplican**). Medido: el stack de gráficos son ≈345 kB de 571 kB (60 %) del único chunk; `lucide-react`
  solo 2.1 kB (tree-shaking OK → `bundle-barrel-imports` sin impacto en producción).
- **Modificado** (commit `perf: apply vercel-react-best-practices skill`): `bundle-dynamic-imports` →
  `React.lazy` + `Suspense` para los dos gráficos, con `ChartSkeleton` compartido (extraído de dos copias
  idénticas). Efecto colateral tratado: un fallo de carga del chunk desmontaba **toda** la app (comprobado:
  `rootChildren: 0`) → `ChartsErrorBoundary`.
- **Verificado** (build de producción, gzip, 1.6 Mbps / 150 ms / CPU ×4, mediana de 7, dos rondas con orden
  invertido; referencia = código tras accesibilidad, ≈ `main` + 1 kB):

  | Métrica | Antes | Después |
  |---|---|---|
  | FCP | 1688–1792 ms | 1100–1108 ms |
  | KPIs visibles | 2284–2402 ms | 1809–1849 ms |
  | LCP | 2320–2444 ms | 1848–1888 ms |
  | Gráficos dibujados | 2810–2888 ms | 2556–2665 ms |
  | CLS | 0.0313 | 0.0307 |
  | JS gzip | 169.8 kB (1 archivo) | 174.3 kB (5 archivos; entrada 60 kB) |

  El aviso de chunk >500 kB desaparece por división real. Escenarios: normal, chunk retrasado 3 s (KPIs a
  t+1.8 s con skeletons de gráfico) y chunk 404 (cabecera + KPIs vivos + `role=alert`), en build de producción
  y en el servidor de desarrollo de Docker.
- Dejado sin cambios a propósito: `async-parallel` (ya cumple), `client-swr-dedup` (un solo consumidor),
  `js-combine-iterations`/`js-cache-function-results` (n = 360, sin ganancia medible).

## Skill adicional — `react-testing` (`affaan-m/ecc`)

- Temas explorados: `testing`, `vitest`, `react testing`, `typescript`, `web performance`, `seo`
  (`npx skills find performance` → "No skills found"). Candidatas revisadas: `javascript-testing-patterns`,
  `vitest` (antfu), `react-testing-library`, `react19-test-patterns`.
- Elegida por el gap documentado "no hay tests de componentes React" (0 % de cobertura en todos los
  componentes y en `App.tsx`) y por traer patrones de error boundary y Suspense.
- **Cambios** (commit `test: apply react-testing agent skill`): devDependencies `@testing-library/react`,
  `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom`; bloque `test` en `vite.config.ts` (proxy
  intacto) y `src/test/setup.ts`; 5 archivos `*.test.tsx` (11 tests) con consultas por rol.
- **Validación**: vitest 6 → 17 tests (también dentro del contenedor); cobertura de `src/` 30.2 % → 86.8 %
  de sentencias; 7 mutaciones (quitar `role=alert`, `lang`, `role=status`, el boundary, el `h2`, el `caption`,
  el placeholder del KPI) pusieron en rojo al menos un test cada una.
- Desviaciones: sin MSW (un solo consumidor de `fetch`; se espía `fetch`) y sin `jest-axe` (no hay componentes
  interactivos; axe se ejecutó en navegador real).

## Skill interna — `dashboard-pre-merge-qa`

- Ubicación: `.skills/dashboard-pre-merge-qa/SKILL.md` (referenciada desde `AGENTS.md`; Claude Code no
  autodescubre `.skills/`).
- Gap que resuelve (demostrado): sin CI, y `testing.md` pedía solo `lint` + `test`; con un error de tipos ambos
  salen con exit 0 y solo `npm run build` falla (`tsc -b` no existe en otro sitio). Añade la secuencia exacta,
  las trampas de Docker en Windows y los contratos de UI del dashboard.
- Prueba: QA previo al merge de esta rama. Detectó 4 fricciones (diff inflado por skills instaladas, comando
  de `grep` mal escrito que dio un falso "none", ausencia de herramienta e2e, docs obsoletas) y se corrigió la
  skill antes del commit.

## Estado final (HEAD de la rama tras esta actualización)

| Comprobación | Resultado |
|---|---|
| `npm run build` (incluye `tsc -b`, tipa también los tests) | PASS; entrada 188 kB (60 kB gzip) + chunk `LineChart` 343 kB (101 kB gzip); **sin** aviso de chunk grande |
| `npm run test` | PASS 17/17 (6 archivos) |
| `npm run lint` | PASS (0 problemas) |
| Typecheck | Solo dentro de `npm run build`; no hay script `typecheck` |
| `pytest` (contenedor) | PASS 15/15, 2 `DeprecationWarning` preexistentes |
| Navegador (Edge, 1440 y 375 px) | 2 gráficos, 0 errores de consola, axe 0 violaciones, Tab llega a ambos gráficos con foco visible, `ArrowRight` activa el tooltip como `role=status`, sin scroll horizontal, periodo de cabecera = `min_date`–`max_date` de facets |

### Limitaciones

- **No se probó con un lector de pantalla real** (NVDA/VoiceOver); la accesibilidad se verificó con árbol ARIA,
  axe-core y teclado. Las tablas y live regions están, pero su experiencia real no está medida.
- jsdom no dibuja Recharts: cuerpo de los gráficos y tooltips (≈ 13 % de `src/`) sin test automático; siguen
  verificados solo en navegador real.
- Rendimiento medido en una máquina con throttling emulado, no en usuarios reales.
- Skills y `Skill` tool: `accessibility` y `vercel-react-best-practices` se leyeron de disco al principio y se
  cargaron formalmente con la herramienta `Skill` cuando el registro se refrescó; `react-testing` (instalada
  a mitad de sesión) y la skill interna (`.skills/`) **no** aparecen en el registro de la sesión: se aplicaron
  leyendo su `SKILL.md`.
- Docker Desktop estaba cerrado y hubo que arrancarlo a mano. Identidad de Git fijada solo en la config local
  del repo (`rubenlosada11`) por indicación del usuario.

### Preexistente (no introducido por esta rama)

- 12 vulnerabilidades de `npm audit`; 2 `DeprecationWarning` de starlette en pytest.
- `mock-data.ts` sin uso; `src/assets/hero.png` sin importar; `'Inter'` declarada pero nunca cargada.
- Mensaje de error en español dentro de una UI en inglés (solo se marcó con `lang="es"`).
- Iconos de leyenda de Recharts con `aria-label` redundante ("income legend icon").
- `.agents/rules/frontend.md` y `backend.md` conservan evidencias con números de línea obsoletos (p. ej. el
  "2024 — Full Year" ya corregido). `frontend/specs/` referencia la rama `loading` de `IncomeOutcomeChart`,
  ahora `ChartSkeleton`, y no menciona estas convenciones.

## Commits de la rama

```text
chore: install accessibility and vercel-react-best-practices agent skills
fix: apply accessibility agent skill improvements
perf: apply vercel-react-best-practices skill
chore: install react-testing agent skill
test: apply react-testing agent skill
feat: add dashboard-pre-merge-qa internal skill
docs: update memory-bank with the agent skills work
```
