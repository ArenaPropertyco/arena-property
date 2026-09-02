# HU-44 — Página Sobre Nosotros

Épica E1 · Sprint 1 · SP 5 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver una página "Sobre Nosotros" con Quiénes somos, Preguntas frecuentes, Testimonios e Información de interés, para conocer más sobre la empresa.

## Requisitos funcionales
- **RF-44.1** — Página pública con 4 secciones: Quiénes somos, Preguntas frecuentes (acordeón), Testimonios e Información de interés.
- **RF-44.2** — FAQs y testimonios se definen como estructuras tipadas iterables (pregunta/respuesta; autor/cita) traducibles por i18n.
- **RF-44.3** — Incluye CTA hacia el flujo de registro/compra.
- **RF-44.4** — Las 4 secciones se declaran en un **manifiesto tipado** en `shared/`; los CA se prueban contra el manifiesto y contra las estructuras de FAQs y testimonios, no contra el marcado (RT-03).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-44.1** — Dado el manifiesto, entonces declara exactamente las 4 secciones de RF-44.1, en orden y sin duplicados.
- **CA-44.2** — Dada la estructura de FAQs, entonces cada entrada tiene pregunta y respuesta no vacías y con identificador único; ídem autor y cita en testimonios.
- **CA-44.3** — Dadas las claves i18n del manifiesto y de ambas estructuras, entonces existen en `en.json` y `es.json` con paridad; el CTA resuelve a la ruta de registro.

## Dependencias
- HU-00 (enlace de origen) · HU-04 (destino del CTA).
