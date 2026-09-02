# HU-42 — Página Beneficios del sistema fraccionado

Épica E1 · Sprint 1 · SP 5 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver una página con los beneficios de una propiedad fraccionada frente a una renta tradicional, para comparar ambas opciones.

## Requisitos funcionales
- **RF-42.1** — Página pública con cuadro comparativo renta tradicional vs. sistema fraccionado, con cifras e información por criterio.
- **RF-42.2** — Los datos del comparativo viven en una estructura tipada (no texto suelto) para poder validarlos y traducirlos.
- **RF-42.3** — Toda cifra estimada del comparativo lleva su condición en el dato (`confirmado` | `estimado`) según TR-02 RF-D.6; la vista solo traduce esa condición a la semántica de color de marca (RT-07/RT-08).
- **RF-42.4** — Incluye CTA hacia el flujo de registro/compra.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-42.1** — Dada la estructura del comparativo, entonces toda fila tiene valor para ambas columnas y ninguna queda sin condición (`confirmado` | `estimado`).
- **CA-42.2** — Dada una fila estimada, entonces la función de presentación de TR-02 la devuelve con condición `estimado` y nunca como confirmada.
- **CA-42.3** — Dados los importes del comparativo, entonces se formatean según TR-02 RF-D.5; claves i18n en paridad es/en.

## Dependencias
- HU-00 (enlace de origen) · HU-04 (destino del CTA).
