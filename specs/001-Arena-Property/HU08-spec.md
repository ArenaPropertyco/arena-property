# HU-08 — Crear propiedad con ficha técnica completa

Épica E3 · Sprint 1 · SP 13 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).
⚠️ Historia de alto riesgo técnico (doble máquina de estados): hacer spike antes de comprometer.

## Historia
Como Administrador de Propiedad, quiero crear una nueva propiedad con su ficha técnica completa, para publicarla en el catálogo.

## Requisitos funcionales
- **RF-08.1** — Formulario con validaciones para: m², habitaciones, baños, estacionamientos, fotos (carga múltiple), video, plano elevado, descripción larga, equipamiento y ubicación.
- **RF-08.2** — Máquina de estados de **visibilidad**: `En borrador` → `Publicada` ↔ `Inactiva`; solo `Publicada` aparece en el catálogo (HU-01).
- **RF-08.3** — Máquina de estados **comercial (D-18)**: `Próximamente` lo marca el Administrador a mano (la propiedad aún no sale a la venta); `Fracciones disponibles` y `Vendido` se **derivan** de los estados de las 8 fracciones (HU-09) en cuanto la propiedad sale de `Próximamente`. "Lista de espera" no es un estado: es la condición derivada de no tener fracciones disponibles (HU-47).
- **RF-08.4** — Ambas máquinas viven como lógica pura en `shared/` con transiciones válidas explícitas; toda transición inválida se rechaza.
- **RF-08.5** — Los archivos (fotos, video, plano) se almacenan en Supabase Storage con políticas por rol.
- **RF-08.6** — La creación queda ligada al Administrador creador (asignación HU-05).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-08.1** — Dado cada par (estado, transición) de ambas máquinas, entonces las válidas transicionan y las inválidas lanzan error tipado (test exhaustivo de la tabla de transiciones).
- **CA-08.2** — Dada una propiedad con las 8 fracciones `vendida`, entonces el estado comercial derivado es `Vendido`; con al menos una disponible, `Fracciones disponibles`.
- **CA-08.3** — Dado un formulario sin campos obligatorios o con valores fuera de rango (m² ≤ 0, etc.), entonces el esquema lo rechaza por campo.
- **CA-08.4** — Dada una propiedad `En borrador`, entonces no aparece en el resultado del composable de catálogo.

## Dependencias
- HU-05 (asignación) · alimenta HU-01/HU-02/HU-09.
