// @nuxt/eslint genera la base a partir de la configuración del proyecto (RT-01).
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['.nuxt/**', '.output/**', 'dist/**', 'supabase/.temp/**', 'shared/types/database.types.ts'],
})
