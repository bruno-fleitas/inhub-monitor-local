# Inhub Monitor Local

Aplicación local de alto rendimiento para el monitor operativo Inhub de Soldati y Esteban Echeverría.

## Objetivo

Procesar localmente los archivos operativos del Inhub y visualizar dashboards ejecutivos sin exponer datos sensibles. La aplicación corre 100% en el navegador como SPA vanilla JS, sin bundler ni frameworks, usando Web Workers para el procesamiento pesado.

Fuentes de datos soportadas:
- TMS (Inhub c/Post CPT, Inhub s/Post, Mix volumétrico, Bigger, SuperBigger)
- Arribos (vehículos, paquetes, tipo de unidad)
- Labelless (cruce con TMS)
- MELI Air (tracking HU separado)
- Registros / Easy Docking (velocidad de descarga, SPR)
- Dotación / Jornales (antigüedad de personal)
- SubCA / CPT (participación y rankings)
- DOT - Dispatch On Time (cumplimiento de CPT)
- Vista Mail (resumen formateado para correo)
- Exportación a PowerPoint y CSV consolidado

## Arquitectura

Monolito modular hexagonal en vanilla JS (ES modules nativos del navegador). Sin dependencias de build ni npm. Todo el código es `type="module"` y se carga directamente desde `index.html`.

```
js/
├── app.js                    ← Entry point / composition root
├── config/                   ← JSON estáticos (masterS.json, masterE.json)
├── core/                     ← Capa de infraestructura compartida
│   ├── dom.js                ← $ helper (getElementById)
│   ├── formatters.js         ← nf, pf, pct, esc, huPercent2
│   ├── state.js              ← state, setFile, names, subcaFilters, dotExclusions
│   ├── time.js               ← hoursUntil, hoursToTarget, fmtDuration
│   ├── config.js             ← masters, initMasters, save, huConfig
│   └── workers.js            ← onceWorker, runT/A/R/L, jw, loadJ, calcJ, progress, status
├── domain/                   ← Capa de dominio (lógica de negocio pura)
│   ├── tms.js                ← classify, num, HU tracking, DOT compliance
│   ├── arrivals.js           ← universe, cut, cuts, buildArrivalCurve, cutoffShare
│   ├── jornales.js           ← classifyTenure, daysBetween
│   └── storage.js            ← cacheSet, cacheGet (IndexedDB)
├── views/                    ← Capa de adaptadores de UI (un módulo por dashboard)
│   ├── summary.js            ← summary()
│   ├── operation.js          ← operation(), speedPanel(), huInhubMini()
│   ├── huControl.js          ← huControl(), huDashboard(), DOT monitor
│   ├── curves.js             ← curves(), flowCurve(), matrices, vehicleDistribution
│   ├── mix.js                ← mix(), pieCard(), packagePie(), vehiclePie()
│   ├── subca.js              ← subca(), filtros, rankings, tablas
│   ├── jornales.js           ← jornales(), runJ(), modal de detalle
│   ├── mail.js               ← mail(), mailHTML(), copy handlers
│   ├── report.js             ← reportPreview(), exportPpt(), exportCsv()
│   ├── docks.js              ← dockDashboard()
│   ├── planVsReal.js         ← planVsReal()
│   ├── huGoal.js             ← huGoalView(), huHourlyGoalPlan()
│   └── config.js             ← masterUI() (editor de SubCA)
└── ui/                       ← Infraestructura de UI
    ├── nav.js                ← initNav()
    ├── fileBindings.js       ← initFileBindings()
    └── injectUI.js            ← injectUI()
```

### Reglas de la arquitectura

1. **`core/`** no depende de `views/` ni `domain/`. Es la base.
2. **`domain/`** contiene lógica pura sin tocar el DOM. Depende solo de `core/`.
3. **`views/`** renderiza HTML desde datos del estado y lógica de dominio. Depende de `core/` y `domain/`.
4. **`ui/`** maneja infraestructura de interfaz (navegación, bindings, inyección de DOM).
5. **`app.js`** es el composition root: importa todo, inyecta dependencias circulares via callbacks (`setRenderAll`, `setRunT`), y maneja el botón de procesar.
6. **Workers** (`workers/`) no se modificaron. Se consumen desde `core/workers.js`.

### Dependencias circulares

`renderAll()` se define en `app.js` pero varias vistas necesitan llamarlo (HU control, jornales, etc.). Para evitar imports circulares, se usa inyección de callbacks:

```js
// app.js
import { setRenderAll as setHuRenderAll, setRunT } from './views/huControl.js';
setHuRenderAll(renderAll);  // inyecta la referencia
setRunT(runT);              // inyecta el worker runner
```

### Documentación

Cada módulo tiene:
- Un bloque JSDoc en el header explicando su responsabilidad en la arquitectura
- `@param` y `@returns` en cada función exportada

## Rendimiento

- Web Workers para TMS (streaming por chunks de 4MB), Jornales (worker persistente), Arribos, Registros y Labelless.
- Worker de Jornales es persistente: se carga una vez y se reutiliza para múltiples análisis sin reindexar.
- Índices en memoria para evitar recalcular todo ante cada filtro.
- Cache local (IndexedDB) para datos ya procesados.
- Progreso visible durante cargas pesadas.

## Seguridad de datos

**No subir a este repositorio archivos reales de operación ni datos personales.**

El `.gitignore` bloquea por defecto CSV y archivos Excel. Los datos se procesan localmente en la computadora del usuario.

## Inicio rápido en Windows

1. Descargar el repositorio como ZIP y descomprimirlo.
2. Hacer doble clic en `ABRIR_MONITOR.bat`.
3. El navegador se abre automáticamente en una dirección local (`127.0.0.1`).
4. Mantener abierta la ventana negra mientras se usa el monitor.
5. Para cerrar el monitor, cerrar esa ventana.

No requiere Python. Usa PowerShell, incluido normalmente en Windows.

## Regla de migración

Cada cálculo migrado debe compararse contra el monitor actual antes de considerarse terminado.
