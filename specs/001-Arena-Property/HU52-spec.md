# HU-52 — Configuración del monto de comisión

Épica E11 · Sprint 3 · SP 5 · Prioridad **Must** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero definir el monto de comisión que se paga por cada referido efectivo, para controlar el costo de adquisición del programa.

## Requisitos funcionales
- **RF-52.1** — Pantalla de configuración del monto de comisión: valor fijo en COP **o** porcentaje (guardado en puntos básicos, TR-02 RF-D.4) sobre el **precio pactado en la compra** registrado en el plan de pagos (D-05), no sobre el precio de lista vigente.
- **RF-52.2** — **Vigencias**: cada cambio crea una nueva vigencia con fecha de inicio; el monto aplicable a un referido es el vigente **al momento de su atribución**, aunque después cambie.
- **RF-52.3** — Histórico inmutable de cambios con fecha y usuario que modificó; las vigencias pasadas no se editan ni borran.
- **RF-52.4** — El monto vigente alimenta la página pública del programa (HU-48); solo el Superadmin configura.
- **RF-52.5** — La resolución "vigencia aplicable a una fecha de atribución" es una función pura.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-52.1** — Dadas vigencias V1 (ene–mar) y V2 (abr→), cuando un referido fue atribuido en febrero, entonces su comisión se calcula con V1 aunque hoy rija V2.
- **CA-52.2** — Dado un porcentaje de 10 % (1000 pb) y un precio pactado de $100.000.000, entonces la comisión es $10.000.000; si el precio de lista de la fracción cambia después, la comisión no cambia.
- **CA-52.3** — Dado un valor fijo ≤ 0 o un porcentaje fuera de rango, entonces se rechaza.
- **CA-52.4** — Dado un cambio de monto, entonces el histórico agrega una entrada con autor y fecha, sin alterar las anteriores.

## Dependencias
- HU-48 (publicación del monto) · HU-51 (fecha de atribución) · HU-54 (cálculo de liberación).
