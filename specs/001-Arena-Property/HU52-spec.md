# HU-52 — Tipos de comisión y su asignación a Embajadores

Épica E11 · Sprint 3 · SP 5 · Prioridad **Must** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero administrar un catálogo de tipos de comisión y decidir cuál se le aplica a cada Embajador, para controlar el costo de adquisición del programa y premiar a quien lo merece sin cambiárselo a todos a la vez.

## Requisitos funcionales
- **RF-52.1** — Catálogo de **tipos de comisión**: cada tipo tiene nombre y valor, que es un importe fijo en COP **o** un porcentaje (guardado en puntos básicos, TR-02 RF-D.4) sobre el **precio pactado en la compra** registrado en el plan de pagos (D-05), no sobre el precio de lista vigente. Solo el Superadmin los crea.
- **RF-52.2** — El **valor de un tipo es inmutable**: para pagar otra cantidad se crea otro tipo (D-37). Un tipo puede **desactivarse**, y entonces deja de ofrecerse para asignaciones nuevas sin alterar las que ya lo usan; también puede renombrarse.
- **RF-52.3** — Exactamente **un tipo es el predeterminado**: rige para todo Embajador sin asignación propia y es el que alimenta la página pública del programa (HU-48). Marcar otro como predeterminado retira la marca al anterior.
- **RF-52.4** — El Superadmin **asigna** a cada Embajador aprobado el tipo que decida; retirar la asignación lo devuelve al predeterminado. Cada asignación registra autor y fecha, y queda auditada (TR-01).
- **RF-52.5** — La resolución «tipo aplicable a un Embajador» y el cálculo de la comisión sobre el precio pactado son **funciones puras**.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-52.1** — Dado un Embajador con un tipo asignado y otro sin asignación, entonces el primero cobra con el suyo y el segundo con el predeterminado.
- **CA-52.2** — Dado un tipo del 10 % (1000 pb) y un precio pactado de $100.000.000, entonces la comisión es $10.000.000; si el precio de lista de la fracción cambia después, la comisión no cambia.
- **CA-52.3** — Dado un tipo con importe fijo ≤ 0, porcentaje fuera de rango, nombre vacío o nombre ya usado, entonces se rechaza.
- **CA-52.4** — Dado un intento de cambiar el valor de un tipo ya creado, entonces se rechaza; renombrarlo o desactivarlo sí procede y no altera las asignaciones vigentes.
- **CA-52.5** — Dado que se marca otro tipo como predeterminado, entonces el anterior deja de serlo y queda exactamente uno.
- **CA-52.6** — Dado un rol distinto de Superadmin, cuando intenta crear un tipo o asignarlo a un Embajador, entonces la operación es rechazada.

## Dependencias
- HU-48 (publicación del monto) · HU-49 (Embajadores aprobados) · HU-51 (atribución) · HU-54 (cálculo de liberación).
