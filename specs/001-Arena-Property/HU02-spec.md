# HU-02 — Detalle de propiedad

Épica E1 · Sprint 1 · SP 5 · Prioridad **Must** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver el detalle de una propiedad luego de dar clic en el catálogo, para conocer a profundidad su información.

## Requisitos funcionales
- **RF-02.1** — La ruta de detalle carga por identificador/slug una propiedad `Publicada`; una no publicada o inexistente responde 404, **salvo** para el Administrador asignado y el Superadmin, que la ven en modo vista previa con distintivo de borrador.
- **RF-02.2** — Muestra galería de imágenes y video, plano elevado, descripción larga, ubicación y equipamiento.
- **RF-02.3** — Muestra la ficha técnica (m², habitaciones, baños, estacionamientos), el precio por fracción y el estado comercial con las fracciones disponibles (HU-09).
- **RF-02.4** — Incluye el botón "Contáctanos" que ancla al formulario de contacto de la misma página (HU-03).
- **RF-02.5** — El plano elevado se presenta con un visor 3D en `@tresjs/nuxt` (RT-12); una función pura decide el modo de presentación y devuelve la imagen estática de respaldo cuando no hay WebGL disponible o el visitante tiene `prefers-reduced-motion`.
- **RF-02.6** — Las imágenes de la galería se sirven con `@nuxt/image` (RT-12).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-02.1** — Dado un slug de propiedad `Publicada`, cuando se resuelve el detalle, entonces retorna todos los campos de RF-02.2 y RF-02.3.
- **CA-02.2** — Dado un slug de propiedad `En borrador` o `Inactiva`, cuando se resuelve, entonces el resultado es 404.
- **CA-02.3** — Dada una propiedad con N fracciones vendidas, entonces el conteo de disponibles mostrado es `8 − N` según los estados de HU-09.
- **CA-02.4** — Dado un entorno sin WebGL o con `prefers-reduced-motion`, entonces la función de modo devuelve la imagen estática; con soporte, el visor 3D.

## Dependencias
- HU-01 (origen de navegación) · HU-08/HU-09 (datos) · HU-03 (contacto embebido).
