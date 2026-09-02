# HU-51 — Atribución del referido

Épica E11 · Sprint 2 · SP 8 · Prioridad **Must** · Rol: Embajador
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).
⚠️ Historia de mayor riesgo de negocio de E11: sus reglas evitan disputas de comisiones. Definir aquí, junto a HU-06, el ciclo de vida completo del referido.

## Historia
Como Embajador, quiero que quede registrada la atribución cuando un prospecto ingresa con mi código o enlace y luego se registra o compra, para asegurar que se me reconozca la comisión.

## Requisitos funcionales
- **RF-51.1** — **Ventana de 90 días (D-03):** al ingresar por un enlace con código válido, el sistema persiste la atribución y la reconoce si el prospecto se registra dentro de los **90 días** del primer clic; pasado ese plazo, no hay atribución. El dato de negocio queda en Supabase al registrarse (RT-04).
- **RF-51.2** — El registro (HU-04) y el contacto (HU-46) incluyen campo opcional "Código de referido", prellenado si se llegó por enlace.
- **RF-51.3** — **Un solo Embajador por prospecto**: la primera atribución gana; ingresos posteriores con otros códigos no la sobreescriben.
- **RF-51.4** — **Sin auto-referencia**: un Embajador no puede referirse a sí mismo (mismo usuario o mismo email); el intento se ignora con aviso.
- **RF-51.5** — La atribución queda vinculada de forma permanente al prospecto y se arrastra a la compra de fracción (HU-06); su ciclo de vida: `Registrado` → `En proceso de pago` → `Pago completado` (estados consumidos por HU-53/HU-54).
- **RF-51.6** — Un código inválido, inhabilitado (HU-33) o inexistente no crea atribución y no bloquea el flujo del prospecto.
- **RF-51.7** — **Una sola comisión por prospecto (D-04):** la atribución acompaña al prospecto de por vida, pero solo su **primera** compra de fracción genera comisión.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-51.1** — Dado un prospecto que ingresa con el código A y luego con el código B, cuando se registra, entonces la atribución es del Embajador A.
- **CA-51.2** — Dado un Embajador que usa su propio código, entonces no se crea atribución.
- **CA-51.3** — Dado un prospecto atribuido que compra una fracción (HU-06), entonces la atribución sigue al ciclo de compra y su estado transiciona según los pagos.
- **CA-51.4** — Dada la tabla de transiciones del ciclo del referido, entonces las inválidas (p. ej. `Registrado` → `Pago completado` sin pasar por compra) se rechazan.
- **CA-51.5** — Dado un código inhabilitado, entonces el registro procede sin atribución.
- **CA-51.6** — Dado un clic hace 89 días, entonces el registro queda atribuido; hace 91 días, no.
- **CA-51.7** — Dado un referido que ya generó comisión por su primera fracción, entonces su segunda compra no genera una nueva.

## Dependencias
- HU-50 (código) · HU-04/HU-46 (captura) · HU-06 (compra) · HU-33 (inhabilitación) · alimenta HU-53/HU-54.
