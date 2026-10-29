# Continuidad del Monitor Operativo Inhub

> Documento de traspaso para ChatGPT Work, otro asistente o un desarrollador. Fuente de verdad: código de la rama principal de [inhub-monitor-local](https://github.com/bruno-fleitas/inhub-monitor-local). Última revisión documental: 2026-10-28.

## Prompt para una nueva conversación o Work

Estoy continuando el desarrollo del **Monitor Operativo Inhub** de Soldati y Esteban Echeverría, publicado en https://bruno-fleitas.github.io/inhub-monitor-local/ y desarrollado en https://github.com/bruno-fleitas/inhub-monitor-local .

**Antes de tocar código:** leer `README.md`, `docs/DOCUMENTACION_TECNICA.md`, `docs/DICCIONARIO_Y_CALCULOS.md`, este documento, `index.html`, `js/app.js`, `js/state.js`, `js/modules/*.js`, `workers/*.js` y `css/app.css`. Contrastar toda afirmación con el código vigente y, cuando corresponda, con el historial de commits.

El monitor procesa datos operativos **localmente**, para dos sites independientes. No subir CSV, Excel ni datos reales al repositorio. Mantener las funcionalidades, filtros, cifras, vistas, exportaciones y reglas que no se solicite modificar. Hacer cambios pequeños y verificables; explicar qué archivos y funciones cambiaron, qué pruebas se hicieron y qué quedó sin verificar.

Cuando solicite una modificación:
1. Identificar la vista, función, origen y fórmula afectados.
2. Inspeccionar las dependencias y posibles impactos en otros módulos.
3. Implementar el cambio más acotado posible, sin alterar otros cálculos.
4. Validar con ejemplos de entrada/salida, casos sin datos, ambos sites y regresiones.
5. Actualizar documentación y, si cambia JS/CSS publicado, revisar invalidación de caché de `index.html`.
6. Reportar commit y estado real de verificación; nunca afirmar que se probó visualmente sin hacerlo.

### Decisiones recientes confirmadas: Reporte gerencial
- Vista `reporte`; función `reportPreview()` en `js/app.js`; estilo en `css/app.css`.
- Un bloque por site disponible; Soldati y Echeverría comparten presentación.
- Cortes **pre14, pre16, pre17, pre18, post20**; NO pre20.
- PRE: acumulado desde las 09:00 hasta antes del corte. POST20: desde las 20:00, cruzando medianoche hasta antes de las 09:00.
- Paquetes: porcentaje del **proyectado de paquetes editable** por site, persistido en localStorage.
- Vehículos: porcentaje del **total real de vehículos ingresados**, no de un proyectado. No mostrar campo editable para vehículos.
- Mostrar `Total vehículos ingresados`, no un reloj/fecha de actualización inferidos de marcas TMS.
- Etiqueta visible `Camioneta`, sin aclaración `(incluye MELI)`; la agrupación numérica subyacente no se modificó.
- Tablas compactas, centradas, cifras en negrita. Mantener tabla HU y KPIs existentes.
- Se detectó que el navegador mostraba JS antiguo por caché; se corrigió versionando las referencias de CSS/JS en `index.html`.

### Precaución crítica
**Existe una discrepancia de unidades y umbrales entre `js/modules/tms.js` y `workers/tms.worker.js`**. No unificar ni alterar silenciosamente: determinar qué ruta se ejecuta, las unidades reales de ambos formatos de CSV y comprobar resultados operativos antes de decidir. Ver `docs/DICCIONARIO_Y_CALCULOS.md`.

## Fuentes de recuperación
- Repositorio y commits: historial técnico verificable.
- Estos documentos: contexto de continuidad, sujeto a verificación.
- Conversaciones previas: decisiones históricas útiles, pero no sustituyen la revisión de código.
- Archivos de prueba **anonimizados**: necesarios para confirmar resultados; no incluir datos sensibles en GitHub.

## Próxima tarea de documentación
Realizar auditoría exhaustiva por módulo de `js/app.js` (archivo grande), `workers/tms.worker.js`, `workers/jornales.worker.js` y formatos CSV reales; agregar matriz de pruebas y ejemplos con datos anonimizados. Las notas actuales identifican lo verificado y lo pendiente, y no deben interpretarse como una certificación de todas las fórmulas.

## Requisito obligatorio: compatibilidad con dos CSV de TMS
El monitor debe aceptar **dos formatos diferentes de CSV de TMS: formato anterior y formato nuevo**. No eliminar soporte de ninguno al modificar importación, encabezados, conversiones, fechas, filtros o indicadores. La compatibilidad es un requisito de regresión para **Soldati y Echeverría**.

Antes de cambiar código: comparar ambos encabezados y muestras anonimizadas, identificar campos equivalentes y diferencias de unidades, comprobar que ambos generan los mismos resultados esperados para registros equivalentes y documentar excepciones. **No se ha certificado todavía** la equivalencia completa entre ambos formatos; no inventar el mapeo ni asumir que todos los encabezados son iguales.
