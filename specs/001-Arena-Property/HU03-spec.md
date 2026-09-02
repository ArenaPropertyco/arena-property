# HU-03 — Contacto desde la ficha de propiedad

Épica E1 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero contactar a Arena Property desde la ficha de una propiedad, para resolver dudas antes de comprar.

## Requisitos funcionales
- **RF-03.1** — El botón "Contáctanos" de la ficha desplaza/enfoca al formulario de contacto dentro de la misma página del detalle.
- **RF-03.2** — El formulario incluye el campo "Intención de compra" con exactamente estas 4 opciones: (a) Estoy activamente buscando comprar una segunda vivienda; (b) Tengo una casa familiar o compartida pero quiero algo que sea realmente mío; (c) Cada verano arriendo en el mismo lugar pero sueño con tener algo mío; (d) Estoy atento a oportunidades de inversión inmobiliaria.
- **RF-03.3** — Incluye campo "Mensaje" libre y datos de contacto; la validación (requeridos, formato de email) vive en un composable/esquema reutilizable con HU-46.
- **RF-03.4** — El envío persiste la solicitud asociada a la propiedad y dispara el correo interno por TR-03, con límite de tasa (D-24).
- **RF-03.5** — Si la sesión trae un código de referido (HU-51), el formulario lo incluye prellenado.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-03.1** — Dado un envío sin email válido o sin intención de compra, cuando se valida, entonces el esquema lo rechaza con errores por campo traducidos.
- **CA-03.2** — Dado un envío válido desde la propiedad P, cuando se procesa, entonces el registro queda vinculado a P con la intención seleccionada.
- **CA-03.3** — Dado el campo de intención, entonces sus opciones son exactamente las 4 de RF-03.2 (claves i18n en paridad es/en).

## Dependencias
- HU-02 (página contenedora) · HU-46 (esquema de validación y canal de correo compartidos) · HU-51 (código de referido opcional).
