# HU-46 — Formulario general de contacto

Épica E1 · Sprint 1 · SP 3 · Prioridad **Must** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero llenar un formulario general de contacto, para dejar mis datos y ser contactado por Arena Property.

## Requisitos funcionales
- **RF-46.1** — Campos: Nombre, Apellidos, Correo electrónico, Teléfono, Mensaje y botón de envío; todos con validación en esquema tipado reutilizable (compartido con HU-03).
- **RF-46.2** — Selección "¿Qué tipo de propiedad estás buscando comprar?" con opciones exactas: Vivienda Vacacional / Vivienda Residencial / Terreno.
- **RF-46.3** — Selección "Renta Familiar Mensual Promedio" con opciones exactas: Menos de $4.000.000 / Entre $4.000.000 y $7.000.000 / Más de $7.000.000.
- **RF-46.4** — Selección "Intención de compra" con las mismas 4 opciones de HU-03.
- **RF-46.5** — Al enviarse, la solicitud se persiste en Supabase y se envía un correo al correo principal de Arena Property por TR-03, con límite de tasa por IP y correo (D-24).
- **RF-46.6** — Campo opcional "Código de referido", prellenado si la sesión trae atribución (HU-51).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-46.1** — Dado un envío con campos requeridos vacíos o email inválido, cuando se valida, entonces el esquema retorna errores por campo traducidos.
- **CA-46.2** — Dado un envío válido, cuando se procesa, entonces se persiste el registro y se invoca el envío de correo interno exactamente una vez.
- **CA-46.3** — Dadas las tres selecciones, entonces sus opciones son exactamente las de RF-46.2/46.3/46.4 (claves i18n en paridad).

## Dependencias
- HU-51 (atribución opcional) · comparte esquema y canal de correo con HU-03.
