/**
 * Colores semánticos de @nuxt/ui atados a los tokens de marca (principio 8).
 * Ningún componente elige color por su cuenta: todos pasan por estos alias.
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'arena',
      neutral: 'ink',
      // Verde solo para confirmado/positivo; rojo solo para alerta o dato sin confirmar.
      success: 'confirmed',
      error: 'unconfirmed',
    },
  },
})
