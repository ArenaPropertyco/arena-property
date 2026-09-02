# HU-04 — Registro: Visitante → Usuario

Épica E2 · Sprint 1 · SP 3 · Prioridad **Must** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero registrarme y crear una cuenta, para poder iniciar el proceso de compra de una fracción.

## Requisitos funcionales
- **RF-04.1** — Registro por email/contraseña con Supabase Auth (`@nuxtjs/supabase`); validación de email y de fortaleza mínima de contraseña en esquema tipado.
- **RF-04.2** — El registro exige verificación de correo; hasta verificar, la cuenta no accede a rutas privadas.
- **RF-04.3** — Al completar el registro, la cuenta obtiene el rol `Usuario` (perfil en tabla propia con rol, creado por trigger/función de base de datos).
- **RF-04.4** — El formulario incluye campo opcional "Código de referido", prellenado si la sesión trae atribución; al registrarse, la atribución se persiste según las reglas de HU-51.
- **RF-04.5** — Errores de autenticación (email en uso, credenciales inválidas) se muestran traducidos, sin exponer detalles técnicos.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-04.1** — Dado un email inválido o contraseña débil, cuando se valida el esquema, entonces se rechaza con errores por campo.
- **CA-04.2** — Dado un registro completado, entonces el perfil creado tiene rol `Usuario` y ningún otro.
- **CA-04.3** — Dado un registro con código de referido válido, entonces la atribución queda persistida conforme a HU-51; con código inválido, el registro procede sin atribución y se informa.
- **CA-04.4** — Dada una cuenta sin verificar, cuando accede a una ruta privada, entonces el middleware la redirige.

## Dependencias
- HU-51 (reglas de atribución) · base de HU-05/HU-06/HU-07 (roles).
