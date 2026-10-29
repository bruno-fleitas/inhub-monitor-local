# Documentación técnica y funcional — Monitor Operativo Inhub

**Repositorio:** https://github.com/bruno-fleitas/inhub-monitor-local  
**Publicación:** https://bruno-fleitas.github.io/inhub-monitor-local/  
**Sites:** Soldati (`soldati`) y Esteban Echeverría (`echeverria`).  
**Estado:** documentación inicial basada en inspección directa de archivos principales el 2026-10-28. No es todavía una auditoría exhaustiva de las más de 120 mil posiciones de `js/app.js`.

## 1. Propósito y arquitectura
Aplicación web local para integrar indicadores de TMS, arribos, registros de descarga, HU, clasificación volumétrica, SubCA/CPT, dotación/jornales, curvas, proyecciones, vista Mail y exportación gerencial. El objetivo expresado en el README es migrar a arquitectura modular sin alterar reglas de negocio validadas.

Archivos verificados:
- `index.html`: navegación, vistas y carga de CSS/JS con parámetro de versión.
- `css/app.css`: diseño, estilos por vista, estilos específicos de `#view-reporte`.
- `js/app.js`: orquestación de carga, interfaz, indicadores, reportes, tablas y exportación PowerPoint.
- `js/state.js`: estado independiente por site, archivos cargados, resultados procesados y configuración.
- `js/modules/tms.js`: utilidades de conversión y clasificación (atención: reglas diferentes al worker).
- `js/modules/arrivals.js`: curvas por hora y `cutoffShare`.
- `js/modules/jornales.js`: antigüedad y días.
- `js/modules/storage.js`: caché IndexedDB `inhub-monitor-local` / `datasets`.
- `workers/tms.worker.js`: procesamiento TMS en worker, CSV por bloques de 4 MiB, índices y resultados.
- `workers/jornales.worker.js`: procesamiento de jornales con SheetJS.
- El README menciona `js/modules/subca.js` y `js/modules/mail.js`, pero **no se encontraron en las rutas declaradas al momento de esta revisión**. Verificar estructura real antes de asumir que existen.

## 2. Vistas identificadas en index.html
`resumen` (Resumen ejecutivo), `operacion`, `hu-soldati`, `hu-echeverria`, `curvas`, `plan` (vehículos), `huplan`, `docks`, `mix`, `subca`, `jornales`, `mail`, `reporte` (Reporte gerencial), `config`.

Funciones relacionadas localizadas en `js/app.js`: `summary`, `operation`, `curves`, `planVsReal`, `huGoalView`, `dockDashboard`, `mix`, `subca`, `jornales`, `mail`, `reportData`, `reportPreview`, `exportPpt`, `doPpt`, `renderAll`, `runJ`, `huDashboard`, `dotMonitor`. La existencia de una función no prueba por sí sola que todas sus ramas estén completas.

## 3. Estado y fuentes
`state.sites[site]` incluye `files`, `tms`, `arrivals`, `labelless`, `labellessStandalone`, `jornales`, `registros`. `state.config` incluye `analysisDate`, `curveStart:9`, `cptStart:{soldati:10,echeverria:10}`, `tenureCut1:3`, `tenureCut2:10`, `speedTargetTime` inicialmente `22:00` por site.

TMS: el worker normaliza encabezados (acentos, espacios no separables, guiones bajos), detecta delimitador `,` o `;`, procesa fechas de varios formatos y requiere `Inbound Date Included`. Lee CSV por bloques para no cargarlo completo en memoria. Ver diccionario para campos exactos.

Jornales: el worker utiliza SheetJS, reconoce fecha/hora grabadas y define jornada operativa con cambio de día antes de las 06:00 para esa ruta. **No confundir** ese límite con el de las curvas gerenciales.

Seguridad: no publicar CSV/Excel reales ni datos de colaboradores, usuarios, shipments o terceros en GitHub; usar archivos de prueba anonimizados.

## 4. Reporte gerencial: contrato funcional actual
Implementado por `reportData()` y `reportPreview()` en `js/app.js`. Cada site se representa de manera independiente cuando hay datos. Indicadores observados: total vehículos, Inhub, voluminoso, avance HU, SPR, chasis, camioneta y semi, cortes de paquetes y vehículos, tabla HU por CPT.

**Cortes**: `pre14`, `pre16`, `pre17`, `pre18`, `post20`. PRE suma horas desde 09:00 hasta antes del corte; POST suma 20:00–23:59 y 00:00–08:59. Para paquetes el denominador es el proyectado editable por site; para vehículos es el total real. Los porcentajes no deben forzarse a sumar 100: los PRE son acumulados y POST es una franja distinta.

Persistencia de proyectado de paquetes: `localStorage['inhubReportPlan_'+site+'_packages']`. Valor por defecto proveniente del proyectado existente `x.fc`. Cambiar el input dispara `reportPreview()`.

El campo proyectado de vehículos fue retirado y la tarjeta de fecha del último registro se reemplazó por total de vehículos. La etiqueta gerencial `Camioneta` no altera la inclusión de MELI en su agregación.

CSS: tablas centradas y compactas; estilos delimitados por `#view-reporte` para evitar afectar otras pantallas. `index.html` usa referencias versionadas de `css/app.css` y `js/app.js`: al desplegar cambios, verificar caché.

## 5. Cálculos y excepciones
Ver `DICCIONARIO_Y_CALCULOS.md` para reglas verificadas, columnas y fórmulas. Las definiciones de porcentajes deben explicitar numerador, denominador, ventana horaria, fuente y exclusiones. Nunca sustituir denominadores entre TMS, Registros y Arribos sin comprobar su correspondencia.

## 6. Historial de decisiones recientes
- Se agregaron cortes horarios y proyectados a Reporte gerencial.
- Se ajustó el diseño de tablas, centrado, ancho y negrita.
- Se corrigió el concepto de vehículos: porcentajes sobre total real, sin proyectado editable.
- Se retiró la tarjeta de fecha de último registro porque confundía marca de datos con actualización de la interfaz.
- Se simplificó la etiqueta `Camioneta`.
- Se versionaron referencias estáticas en `index.html` tras observar una publicación aparentemente desactualizada.
Para historia completa, inspeccionar `git log` y `git show`, no inferir el contenido de commits no revisados.

## 7. Procedimiento de mantenimiento seguro
1. Registrar requerimiento y alcance exacto (vista, site, datos, visualización).
2. Leer el código actual, no editar a partir de una copia antigua.
3. Identificar fórmula, columna y dependencias antes de cambiar.
4. Probar con ambos sites, uno solo cargado, archivos ausentes, valores cero, horas 00–08 y post20.
5. Comparar resultados con datos de control y con el comportamiento anterior en pantallas no modificadas.
6. Revisar errores de consola y exportación PowerPoint cuando corresponda.
7. Commit descriptivo, validar GitHub Pages y actualizar `docs/`.

## 8. Pendientes explícitos de auditoría
- Mapear cada pantalla y cada fórmula de `js/app.js`, incluyendo filtros de HU, SubCA, DOT, Mail, proyecciones y exportación.
- Verificar compatibilidad de todos los formatos CSV anteriores y actuales con muestras anonimizadas.
- Resolver discrepancia de clasificación entre módulo TMS y worker sin cambiar comportamiento hasta validar unidades.
- Agregar pruebas automatizadas de cortes y casos límite.
- Confirmar en qué casos `vehiclesByHour` tiene campos `veh`, por tipo y cómo se arma el total.
