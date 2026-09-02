# HU-50 — Código de referido único y enlace compartible

Épica E11 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Embajador
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Embajador, quiero tener un código de referido único y un enlace compartible, para invitar prospectos y que quede registrado que vienen de mi parte.

## Requisitos funcionales
- **RF-50.1** — Al aprobarse la inscripción (HU-49) se genera automáticamente un código único e irrepetible (unicidad garantizada por constraint en base de datos; la generación es función pura testeable con formato definido: legible, sin ambigüedades tipo 0/O, longitud fija).
- **RF-50.2** — El código **no cambia en el tiempo** y queda asociado permanentemente al Embajador; no es editable por nadie.
- **RF-50.3** — Enlace compartible que incluye el código como parámetro y aterriza en el sitio público persistiendo la atribución (HU-51).
- **RF-50.4** — UI con botones de copiar código, copiar enlace y compartir por WhatsApp, correo y redes (enlaces de compartición generados por función pura).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-50.1** — Dada la generación de N códigos, entonces todos cumplen el formato definido y no hay colisiones (y el constraint rechaza duplicados).
- **CA-50.2** — Dado un código generado, entonces ningún flujo permite modificarlo.
- **CA-50.3** — Dado el enlace compartible, entonces contiene el código correcto y apunta a la ruta pública definida.
- **CA-50.4** — Dados los enlaces de WhatsApp/correo, entonces incluyen el enlace de referido correctamente codificado (URL-encoding).

## Dependencias
- HU-49 (inscripción) · HU-51 (consumo del código) · HU-33 (inhabilitación por suspensión).
