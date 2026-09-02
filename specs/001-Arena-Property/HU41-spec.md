# HU-41 — Página Modelo de negocio

Épica E1 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver una página con información detallada del modelo de negocio y cómo me hago dueño de una fracción, para entender el modelo antes de comprar.

## Requisitos funcionales
- **RF-41.1** — Página pública con la explicación detallada del modelo: propiedad dividida en 8 fracciones, derechos de uso por temporada, operación centralizada.
- **RF-41.2** — Explica el camino de compra paso a paso (Visitante → Usuario → Propietario).
- **RF-41.3** — Incluye CTA hacia el flujo de registro/compra (HU-04).
- **RF-41.4** — El contenido se declara en un **manifiesto tipado de secciones** en `shared/` (identificador, orden, clave i18n, destino del CTA); la página lo recorre y los CA se prueban contra él (RT-03). Animación de entrada con `nuxt-aos` y analítica de CTA con `nuxt-gtag` (RT-12).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-41.1** — Dado el manifiesto de la página, entonces contiene las secciones de RF-41.1 y RF-41.2, en orden y sin duplicados.
- **CA-41.2** — Dado el CTA del manifiesto, entonces su destino resuelve a la ruta de registro declarada en el router.
- **CA-41.3** — Dadas las claves i18n del manifiesto, entonces existen en `en.json` y `es.json` con paridad.

## Dependencias
- HU-00 (enlace de origen) · HU-04 (destino del CTA).
