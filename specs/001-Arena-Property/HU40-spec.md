# HU-40 — Ingreso por reserva a terceros

Épica E7 · Sprint 3 · SP 5 · Prioridad **Should** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero registrar el ingreso generado por una reserva a terceros, para llevar el registro financiero de esa renta adicional.

## Requisitos funcionales
- **RF-40.1** — El ingreso registra el valor del alquiler cobrado (> 0, COP), vinculado a la reserva a tercero (HU-39) y a la maestra (HU-23: categoría de ingreso, tipo de pago).
- **RF-40.2** — **El destino del ingreso lo decide el origen de la semana (D-39).** Una función pura resuelve el reparto a partir del motivo con que la semana entró a la bolsa de renta (RF-39.2b):
  - **Liberada voluntariamente** por su Propietario (RF-14.7): el ingreso **no se prorratea**. Se acredita íntegro a la fracción que la liberó, descontada la comisión de gestión de RF-40.4.
  - **Cancelada, caducada a 60 días o sobrante de la rejilla**: se prorratea entre las 8 fracciones con la función canónica de TR-02 RF-D.2, como hasta ahora, imputando al titular del inventario las de calendario inactivo (D-08).
- **RF-40.3** — Una reserva a tercero admite a lo sumo un ingreso vigente; correcciones son anulación auditable + nuevo registro.
- **RF-40.4** — **Comisión de gestión (D-39).** Sobre el ingreso de una semana liberada se aplica un porcentaje declarado que configura el Superadmin **por propiedad**. El neto de la fracción es el bruto menos la comisión, truncando al peso según TR-02, y la comisión es ingreso de plataforma de Arena: se registra en el libro de HU-25 y **nunca** se prorratea entre las fracciones (simétrico a RF-23.5).
- **RF-40.5** — **Sin porcentaje configurado no hay registro.** Si la propiedad no tiene definida su comisión de gestión, el ingreso de una semana liberada se rechaza con motivo traducido, en lugar de inventar un reparto. La propiedad puede seguir registrando ingresos de las demás semanas, que no dependen de ese dato.
- **RF-40.6** — El ingreso alimenta HU-18, HU-19, HU-24 y HU-25 con su naturaleza explícita: prorrateado o atribuido a una fracción. Ninguna vista presenta como prorrateada una cuota que no lo es (RT-08, P-09).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-40.1** — Dado un ingreso de $800.000 sobre una semana **cancelada**, entonces cada fracción recibe $100.000 y la suma es exacta.
- **CA-40.2** — Dado un intento de segundo ingreso sobre la misma reserva, entonces se rechaza.
- **CA-40.3** — Dado un ingreso registrado, entonces aparece en el dashboard del Propietario (HU-18/HU-19) y en el reporte global (HU-25) del periodo.
- **CA-40.4** — Dado un ingreso de $800.000 sobre una semana **liberada voluntariamente** por la fracción 3/8 y una comisión del 20 %, entonces la fracción 3/8 recibe $640.000, las otras siete reciben $0, Arena registra $160.000 de comisión y la suma de las tres cifras es exactamente $800.000.
- **CA-40.5** — Dada una semana liberada en una propiedad **sin comisión configurada**, cuando se intenta registrar su ingreso, entonces se rechaza con motivo traducido y no se crea ninguna cuota.
- **CA-40.6** — Dado un bruto que no divide exacto con la comisión, entonces el neto se trunca al peso y comisión + neto siguen sumando el bruto sin perder ni un peso (TR-02 RF-D.1).
- **CA-40.7** — Dada la anulación del ingreso de una semana liberada, entonces se revierten tanto la cuota de su fracción como la comisión de plataforma, de forma auditable.

## Dependencias
- HU-39 (reserva a tercero y origen de la semana) · HU-14 (liberación voluntaria) · HU-23 (maestra y prorrateo) · TR-02 (dinero entero y truncado) · D-39.
