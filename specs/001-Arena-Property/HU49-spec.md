# HU-49 — Inscripción como Embajador

Épica E11 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Usuario / Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Usuario o Propietario, quiero inscribirme en el Programa de Referidos para convertirme en Embajador, para empezar a referir clientes y generar ingresos pasivos.

## Requisitos funcionales
- **RF-49.1** — Formulario de inscripción disponible solo para cuentas registradas con rol Usuario o Propietario (nunca Superadmin ni Administrador, según matriz de permisos).
- **RF-49.2** — Requiere aceptación explícita de términos y condiciones del programa (con versión de los términos aceptados persistida).
- **RF-49.3** — Captura datos de pago para el desembolso: banco, tipo de cuenta, número de cuenta y titular, con validación tipada.
- **RF-49.4** — Al aprobarse la inscripción, la cuenta **suma** el rol Embajador sin perder su rol previo, y se genera su código de referido (HU-50).
- **RF-49.5** — El Superadmin ve y gestiona la lista de embajadores inscritos (estado, datos de pago, fecha de alta).
- **RF-49.6** — Una cuenta no puede inscribirse dos veces.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-49.1** — Dado un envío sin aceptación de términos o con datos de pago incompletos, entonces la validación lo rechaza por campo.
- **CA-49.2** — Dada una inscripción aprobada de un Propietario, entonces la cuenta tiene los roles Propietario y Embajador.
- **CA-49.3** — Dada una cuenta ya Embajador, cuando intenta inscribirse de nuevo, entonces se rechaza.
- **CA-49.4** — Dado un Administrador de Propiedad, cuando intenta inscribirse, entonces la opción es denegada.

## Dependencias
- HU-04 (cuenta registrada) · HU-07 (rol acumulable) · HU-50 (código) · HU-48 (origen del CTA).
