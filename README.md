# Inhub Monitor Local

Aplicación local de alto rendimiento para el monitor operativo Inhub de Soldati y Esteban Echeverría.

## Objetivo

Migrar el monitor existente a una arquitectura modular sin cambiar las reglas de negocio ya validadas.

La aplicación procesará localmente:
- TMS
- Arribos
- Labelless
- MELI Air
- Mix volumétrico / Bigger / SuperBigger
- SubCA / CPT
- Dotación / Jornales
- Vista Mail
- Exportaciones

## Rendimiento

La nueva arquitectura separa la interfaz del procesamiento pesado:

- Web Workers para TMS y Jornales.
- Índices en memoria para evitar recalcular todo ante cada filtro.
- Cache local para datos ya procesados.
- Módulos independientes por funcionalidad.
- Progreso visible durante cargas pesadas.

## Seguridad de datos

**No subir a este repositorio archivos reales de operación ni datos personales.**

El `.gitignore` bloquea por defecto CSV y archivos Excel. Los datos se procesarán localmente en la computadora del usuario.

## Estructura

```text
inhub-monitor-local/
├── index.html
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   ├── state.js
│   └── modules/
│       ├── tms.js
│       ├── arrivals.js
│       ├── jornales.js
│       ├── subca.js
│       ├── mail.js
│       └── storage.js
├── workers/
│   ├── tms.worker.js
│   └── jornales.worker.js
└── vendor/
```

## Regla de migración

Cada cálculo migrado debe compararse contra el monitor actual antes de considerarse terminado.


## Inicio rapido en Windows

1. Descargar el repositorio como ZIP y descomprimirlo.
2. Hacer doble clic en `ABRIR_MONITOR.bat`.
3. El navegador se abre automaticamente en una direccion local (`127.0.0.1`).
4. Mantener abierta la ventana negra mientras se usa el monitor.
5. Para cerrar el monitor, cerrar esa ventana.

No requiere Python. Usa PowerShell, incluido normalmente en Windows.
