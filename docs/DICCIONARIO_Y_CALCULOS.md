# Diccionario de datos y catálogo de cálculos

**Alcance:** campos y fórmulas comprobados en archivos fuente. Los demás campos y filtros requieren auditoría adicional; no se deben inventar.

## 1. TMS: columnas consultadas por workers/tms.worker.js
La función `setup(h)` resuelve encabezados normalizados y crea estos índices:

| Índice interno | Encabezados aceptados | Uso observado |
|---|---|---|
| `inDate` | `Inbound Date Included` | Fecha de inclusión inbound; **obligatorio** |
| `outDate` | `Outbound Included Date` | Fecha de inclusión outbound / HU |
| `outId` | `Outbound ID` | Identificador outbound |
| `weight` | `Weight` | Clasificación volumétrica |
| `height` | `Height` | Clasificación volumétrica |
| `length` | `Length` | Clasificación volumétrica |
| `width` | `Width` | Clasificación volumétrica |
| `zone` | `Labeling Zone`, `SubCA` | Agrupación por SubCA |
| `ship` | `Shipment ID`, `SHIPMENT_ID`, `SHIPMENT ID`, `SHIPMENT` | Identificador de envío |
| `status` | `Hub Status` | Estado de operación |
| `outUser` | `Outbound User IDs`, `Outbound User ID` | Actividad de usuarios HU |
| `dispatchDate` | `Dispatch Date Finished` | Fecha de despacho |
| `dock` | `Inbound Dock ID` | Métricas de docks |
| `inUser` | `Inbound User ID`, `Inbound User IDs` | Usuarios inbound |

**Importante:** esta tabla cubre las columnas indexadas por `setup`, no todas las columnas que puedan aparecer en los CSV. La normalización reduce diferencias de mayúsculas, acentos, espacios no separables y guiones bajos. Validar casos de renombre de columnas contra archivos reales anonimizados.

## 2. Clasificación volumétrica — discrepancia crítica
En `js/modules/tms.js`, la función `classify(row)` usa `kg = num(Weight)/10000` y dimensiones directas:
- SuperBigger: peso **>50 kg** o cualquier dimensión **>2000**.
- Bigger: peso **>30 kg** o cualquier dimensión **>1500**.
- Voluminoso: peso **>=20 kg** o cualquier dimensión **>=500**.
- Paquetería: resto.
Prioridad: SuperBigger, Bigger, Voluminoso, Paquetería.

**Sin embargo**, en `workers/tms.worker.js` la función `classify(w,h,l,wi)` usa `kg = num(Weight)/1000` y umbrales dimensionales **>200, >150 y >=50**, respectivamente. El comentario del worker afirma peso en gramos y dimensiones en centímetros.

**NO afirmar que estas rutas son equivalentes.** Antes de corregir, identificar cuál se usa realmente para cada archivo, cuáles son las unidades de los CSV de entrada y comparar muestras representativas. Esta diferencia es un riesgo de discrepancias en los porcentajes.

## 3. Reglas TMS verificadas en el worker
- `totalConPost`: incrementa cuando `Inbound Date Included` pertenece al día de análisis (`sameDay(pin,cfg.selectedDate)`).
- `totalSinPost`: dentro del día seleccionado, incrementa si la hora de inclusión inbound es mayor o igual a `cptStart`.
- `vol`: cuenta filas clasificadas distintas de Paquetería.
- `big`: cuenta Bigger.
- `sb`: cuenta SuperBigger.
- `by[h]`: acumula `tot`, `vol`, `big`, `sb` por hora de inclusión inbound.
- El worker registra máximos `maxInTs` y `maxOutTs`, pero estos **no son** una marca confiable de hora de actualización del monitor.
- Se generan agrupaciones de HU, usuarios, SubCA, docks, MELI y labelless; sus filtros completos requieren revisión función por función.

## 4. Fórmulas de Reporte gerencial
Definiciones: `E[h]` = paquetes de Registros de descarga en hora h; `V[h]` = vehículos de Arribos/Registros en hora h; `P` = proyectado editable de paquetes; `T` = total real de vehículos.

| Corte | Numerador |
|---|---|
| pre14 | suma horas 09 a 13 |
| pre16 | suma horas 09 a 15 |
| pre17 | suma horas 09 a 16 |
| pre18 | suma horas 09 a 17 |
| post20 | suma horas 20 a 23 y 00 a 08 |

Para cada corte:
- Paquetes ingresados = suma `E[h]`; porcentaje = `100 × ingresados / P` si `P>0`.
- Vehículos ingresados = suma `V[h]`; porcentaje = `100 × ingresados / T` si `T>0`.
- Porcentajes con un decimal, configuración regional `es-AR`.
- PRE es acumulado: los cortes se superponen. No sumar porcentajes PRE.
- En ausencia de denominador, la interfaz muestra una indicación en lugar de dividir por cero.

**Ejemplo comprobable de captura de Soldati**: total vehículos `T=459`; pre14 `106/459=23,1%`; pre16 `204/459=44,4%`; pre17 `270/459=58,8%`; pre18 `335/459=73,0%`; post20 `12/459=2,6%`. Proyectado paquetes `P=129000`; pre14 `19033/129000=14,8%`.

### Otras fórmulas observadas
- `pct(a,b)` en `js/app.js`: `b ? a/b*100 : 0`.
- `SPR general` del reporte: paquetes ED de Registros / vehículos de Registros (cuando ambos valores están disponibles).
- Share por tipo de vehículo: vehículos del tipo / total vehículos × 100.
- `voluminosoSinBiggerSB(result)` en `js/modules/tms.js`: `pure=max(0,vol-big-sb)`; denominador `max(0,totalConPost-big-sb)`; `pct(pure,denominador)`. **No asumir que la tarjeta gerencial usa exactamente este denominador** sin revisar su implementación; actualmente `reportPreview` calcula `pct(pure,t.totalConPost)` para esa tarjeta.
- `cutoffShare(curve,cutoff,type)` en `js/modules/arrivals.js`: suma cantidades de horas `<cutoff` y divide por total de la curva.
- `classifyTenure(days,cut1=3,cut2=10)` en `js/modules/jornales.js`: negativos `No contar`, hasta 3 `Nuevo -3 días`, hasta 10 `Nuevo 4-10`, mayores `Antiguo` (parámetros editables).

## 5. Reglas de interpretación
- No mezclar denominadores de Registros, Arribos y TMS: son fuentes diferentes.
- No cambiar silenciosamente filtros de MELI Air, HU, Post, CPT, SubCA o jornales.
- Cuando se documente un filtro nuevo, registrar: **origen → columna → condición → excepciones → numerador/denominador → ejemplo → prueba**.
- Los horarios `09:00` y `20:00` del Reporte gerencial no son necesariamente los mismos cortes que la jornada operativa de jornales (06:00).
- Conservar ejemplos de prueba anonimizados, jamás datos reales de envíos o personas en el repositorio.

## 6. Compatibilidad obligatoria de dos formatos TMS
El monitor debe procesar tanto el **CSV TMS anterior** como el **CSV TMS nuevo**, sin requerir que el usuario modifique manualmente las columnas. Al actualizar el parser o los cálculos, validar ambos formatos con muestras anonimizadas y revisar nombres de encabezados, orden, separador, codificación, fechas, unidades de peso/dimensiones y columnas faltantes. El worker ya contiene normalización y búsqueda por alias de algunas columnas, pero eso **no demuestra** cobertura completa de los dos formatos. Mantener un mapeo explícito de equivalencias verificado contra archivos reales y pruebas de regresión por formato y site. La diferencia de unidades entre el módulo TMS y el worker es especialmente importante para esta verificación.
