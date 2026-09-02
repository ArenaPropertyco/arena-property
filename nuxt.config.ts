export default defineNuxtConfig({

  // Los 13 módulos base de docs/stack.md. Ninguno se agrega sin entrada previa ahí.
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    '@nuxtjs/supabase',
    '@formkit/auto-animate/nuxt',
    '@tresjs/nuxt',
    'nuxt-aos',
    'nuxt-gtag',
    '@nuxt/test-utils/module',
  ],

  css: ['~/assets/css/main.css'],

  site: {
    name: 'Arena Property',
    url: process.env.NUXT_PUBLIC_SITE_URL,
  },

  // RT-07 · el tema claro/oscuro es del usuario, sin forzar preferencia.
  colorMode: {
    preference: 'system',
    fallback: 'light',
  },
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2026-09-01',

  typescript: {
    strict: true,
  },

  // Un solo estilo para todo el repositorio; el formateo no se discute en revisión.
  eslint: {
    config: {
      stylistic: true,
    },
  },

  gtag: {
    id: process.env.NUXT_PUBLIC_GTAG_ID || '',
    enabled: Boolean(process.env.NUXT_PUBLIC_GTAG_ID),
  },

  // RT-05 · dos idiomas en archivos separados y en paridad de claves.
  i18n: {
    defaultLocale: 'es',
    strategy: 'prefix_except_default',
    locales: [
      { code: 'es', language: 'es-CO', name: 'Español', file: 'es.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
  },

  // Ninguna HU pide imágenes OG generadas y el renderizador exige una dependencia
  // fuera de docs/stack.md. El resto de @nuxtjs/seo (meta, sitemap, robots, schema.org) sigue activo.
  ogImage: {
    enabled: false,
  },

  supabase: {
    // Las guardas de rol son de HU-07; hasta entonces el módulo no redirige solo.
    redirect: false,
    // RT-04 · los tipos se generan, no se escriben a mano (T-006).
    types: '~~/shared/types/database.types.ts',
  },
})
