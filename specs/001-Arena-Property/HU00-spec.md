# HU-00 — Home de Arena Property

Épica E1 · Sprint 1 · SP 8 · Prioridad **Must** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero explorar la información general del negocio en la página de inicio, para entender rápidamente qué es Arena Property.

## Requisitos funcionales
- **RF-00.1** — La ruta `/` renderiza, en orden: Navbar, Hero con video de fondo y slogan, sección Modelo de negocio, sección Beneficios, sección Propiedades activas (las publicadas de HU-01, con enlace al catálogo), sección Modelo de agendamiento, sección Qué hace Arena Property, CTA principal y Footer (D-38).
- **RF-00.2** — La composición de la página se declara en un **manifiesto tipado de secciones** en `shared/` (identificador, orden, clave i18n del título, destino del CTA si lo tiene); la página recorre el manifiesto y no fija secciones en el marcado. Es el objeto que prueban los CA (RT-03).
- **RF-00.3** — La sección Modelo de negocio muestra una explicación corta y un botón que navega a la página de detalle (HU-41).
- **RF-00.4** — La sección Beneficios lista ventajas del modelo fraccionado frente a una propiedad completa (bullets cortos) y un botón que navega a la página de detalle (HU-42).
- **RF-00.5** — El CTA principal dirige al registro (HU-04) o al catálogo (HU-01).
- **RF-00.6** — El Navbar y el Footer son componentes compartidos reutilizados por todas las páginas públicas, con selector de idioma (es/en) y de tema (claro/oscuro).
- **RF-00.7** — Las secciones del manifiesto se animan con `nuxt-aos` (RT-12); una función pura resuelve la configuración de animación y devuelve "sin animación" cuando el visitante tiene `prefers-reduced-motion`.
- **RF-00.8** — `nuxt-gtag` registra la vista de página y un evento por activación de CTA, con el identificador de la sección de origen tomado del manifiesto (RT-12).
- **RF-00.9** — La sección Modelo de agendamiento resume el cupo anual por fracción con la **misma tabla de temporadas que publica HU-43**, derivada del criterio de HU-12 (la home no puede prometer nada distinto al motor), y un botón a la página de detalle (HU-43).
- **RF-00.10** — La sección Qué hace Arena Property presenta los tres frentes (estructurar, comercializar, administrar) y la condición de Arena como socio, con un botón a Sobre Nosotros (HU-44).
- **RF-00.11** — Sobre el video, el hero lleva la jerarquía del texto oficial: `h1` «Copropiedad Fraccionada», `h2` la frase y `h3` la promesa de precio. Su revelado es una animación CSS escalonada, para que el texto se vea aunque no corra JavaScript; `motion-v` se reserva a micro-interacciones que nunca ocultan contenido, y las transiciones CSS al estado de reposo. Todo movimiento se apaga con `prefers-reduced-motion` (RT-12).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-00.1** — Dado el manifiesto de la home, entonces contiene exactamente las nueve secciones de RF-00.1, en ese orden y sin identificadores duplicados.
- **CA-00.2** — Dada cada sección con CTA, entonces su destino resuelve a una ruta declarada del router: Modelo de negocio → HU-41, Beneficios → HU-42, Propiedades activas → catálogo (HU-01), Modelo de agendamiento → HU-43, Qué hace Arena Property → HU-44, CTA principal → registro o catálogo.
- **CA-00.3** — Dadas las claves i18n del manifiesto, entonces todas existen en `en.json` y `es.json` con paridad.
- **CA-00.4** — Dado `prefers-reduced-motion` activo, entonces la función de animación devuelve la configuración sin movimiento para todas las secciones.
- **CA-00.5** — Dada la activación de un CTA, entonces la función de analítica produce un evento con el identificador de sección correcto, una sola vez.
- **CA-00.6** — Dada la tabla de temporadas de la home, entonces es exactamente la publicada por HU-43: las mismas semanas y noches por temporada y el mismo total (RF-00.9).

## Dependencias
- HU-41 y HU-42 (rutas destino); HU-04 y HU-01 (destino del CTA). Pueden implementarse como rutas placeholder dentro del mismo sprint.
