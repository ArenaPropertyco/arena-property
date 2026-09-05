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

  // RT-07 · el icono de marca en la pestaña y en la pantalla de inicio del móvil.
  // El `.ico` lleva 16, 32 y 48 px para los navegadores que aún lo piden; el `.svg`
  // es el que usan los modernos y no pixela en ninguna densidad de pantalla.
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
      ],
    },
  },

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
  // DT-08 · correo interno por la API REST de Resend, solo en servidor.
  runtimeConfig: {
    resendApiKey: '',
    contactInbox: '',
    mailFrom: 'Arena Property <no-reply@arena-property.com>',
  },

  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2026-09-01',

  typescript: {
    strict: true,
  },

  // RF-00.7 · RT-12 · entrada de las secciones institucionales. Una sola vez y
  // corta: el lujo no se anima de más. Con `prefers-reduced-motion` la página no
  // pone los atributos y AOS no interviene (CA-00.4).
  aos: {
    once: true,
    duration: 700,
    easing: 'ease-out-cubic',
    offset: 60,
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

  // RF-02.6 · RT-12 · las fotos vienen firmadas desde Supabase Storage; el
  // proveedor de imagen necesita conocer el dominio para optimizarlas.
  image: {
    domains: [process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'].map(url => new URL(url).host),
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
