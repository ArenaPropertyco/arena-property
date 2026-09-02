# HU-40 — Ingreso por reserva a terceros

Épica E7 · Sprint 3 · SP 5 · Prioridad **Should** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero registrar el ingreso generado por una reserva a terceros, para llevar el registro financiero de esa renta adicional.

## Requisitos funcionales
- **RF-40.1** — El ingreso registra el valor del alquiler cobrado (> 0, COP), vinculado a la reserva a tercero (HU-39) y a la maestra (HU-23: categoría de ingreso, tipo de pago).
- **RF-40.2** — El monto se prorratea automáticamente entre las 8 fracciones con la misma función de prorrateo de HU-23 y se suma a las utilidades de la propiedad (alimenta HU-18, HU-19, HU-24 y HU-25).
- **RF-40.3** — Una reserva a tercero admite a lo sumo un ingreso vigente; correcciones son anulación auditable + nuevo registro.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-40.1** — Dado un ingreso de $800.000 sobre una reserva a tercero, entonces cada fracción recibe $100.000 y la suma es exacta.
- **CA-40.2** — Dado un intento de segundo ingreso sobre la misma reserva, entonces se rechaza.
- **CA-40.3** — Dado un ingreso registrado, entonces aparece en el dashboard del Propietario (HU-18/HU-19) y en el reporte global (HU-25) del periodo.

## Dependencias
- HU-39 (reserva a tercero) · HU-23 (maestra y prorrateo).
