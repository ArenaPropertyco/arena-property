# TR-02 — Dinero, prorrateo y formatos

Requisito transversal · Sprint 1 (habilitador) · Rol: sistema
Da cumplimiento al principio 9 de [la constitución](../../docs/constitution.md).
**Todo importe, prorrateo, porcentaje y formato numérico de cualquier `HUXX-spec.md` se implementa según esta spec.**

## Necesidad
"Sin redondeo silencioso" no es verificable sin un tipo de dato y una regla de reparto explícitos.

## Requisitos funcionales
- **RF-D.1** — **Tipo monetario:** todo importe es un entero de pesos colombianos (COP no opera con centavos), almacenado como `bigint` y modelado en TypeScript como un tipo nominal (p. ej. `CopAmount`). Queda prohibido `float`, `double precision` y el uso de `number` sin el tipo nominal para importes.
- **RF-D.2** — **Regla de prorrateo (canónica):** dado un monto `M` entre 8 fracciones, `q = M div 8` y `r = M mod 8`; las primeras `r` fracciones por número ascendente (1/8, 2/8, …) reciben `q + 1` y el resto `q`. La suma de las 8 cuotas es siempre exactamente `M`.
- **RF-D.3** — La cuota que recibió residuo se marca con una bandera en el dato, para que HU-24 pueda hacerlo explícito.
- **RF-D.4** — **Comisión porcentual (HU-52):** `comisión = truncar(precio_fracción × porcentaje ÷ 100)` hacia abajo, al peso; el porcentaje se guarda como entero de puntos básicos (10 % = 1000 pb) para evitar decimales flotantes.
- **RF-D.5** — **Formato de presentación:** los importes se formatean con `Intl.NumberFormat` en `es-CO` / `en-US` sin decimales, con tipografía IBM Plex Mono. Los porcentajes se muestran con **un decimal** (`37,5 %` en español, `37.5%` en inglés).
- **RF-D.6** — La distinción entre valor confirmado y estimado es un campo del dato, no una decisión de la vista: la función de presentación devuelve el valor junto con su condición (`confirmado` | `estimado`), y la UI la traduce a la semántica de color de marca (verde solo confirmado, rojo solo alerta o sin confirmar).
- **RF-D.7** — Todas las funciones de esta spec son puras y viven en `shared/`; ninguna vista replica aritmética monetaria.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-D.1** — Dado `M = 100.000`, entonces las 8 cuotas son 12.500 y su suma es 100.000.
- **CA-D.2** — Dado `M = 100.001`, entonces la fracción 1/8 recibe 12.501, las demás 12.500, la suma es exactamente 100.001 y solo la primera queda marcada con residuo.
- **CA-D.3** — Dado `M = 100.007`, entonces las fracciones 1/8 a 7/8 reciben 12.501 y la 8/8 recibe 12.500 (reparto determinista y repetible).
- **CA-D.4** — Dado el mismo `M` ejecutado dos veces, entonces el reparto es idéntico.
- **CA-D.5** — Dado un precio de fracción de 115.500.000 y 10 % (1000 pb), entonces la comisión es 11.550.000; con 3,33 % (333 pb) el resultado es el truncamiento al peso, sin decimales.
- **CA-D.6** — Dado 3 de 8 fracciones vendidas, entonces el porcentaje formateado es `37,5 %` en español y `37.5%` en inglés.
- **CA-D.7** — Dado un valor marcado como estimado, entonces la función de presentación lo devuelve con condición `estimado` y nunca como confirmado.

## Dependencias
- Habilitador de HU-19, HU-21, HU-23, HU-24, HU-25, HU-27, HU-32, HU-40, HU-42, HU-52, HU-53, HU-54, HU-55 y HU-56: debe existir antes que la primera de ellas.
