import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'

/**
 * El plugin de @nuxtjs/i18n depende del ciclo de petición y no se instala dentro de
 * `mountSuspended`. La suite monta vue-i18n con los diccionarios reales del proyecto,
 * de modo que los componentes se prueban contra las traducciones que van a producción
 * y no contra dobles.
 */
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'es',
  fallbackLocale: 'es',
  messages: { es, en },
})

config.global.plugins.push(i18n)
