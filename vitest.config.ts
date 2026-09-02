import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

/**
 * RT-03 · los cuatro niveles del plan §5.
 *   N1 unit        · dominio puro de `shared/`, sin Nuxt ni base de datos
 *   N2 db          · RLS, restricciones y disparadores contra Supabase local
 *   N3 integration · composables y componentes con Nuxt montado
 *   N4 contract    · manifiestos, stack, marca y paridad de locales
 *
 * `pnpm test` corre los cuatro; `pnpm test:db` corre solo N2, que es el único
 * que necesita infraestructura levantada.
 */

const alias = {
  '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
}

export default defineConfig(async () => ({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          alias,
        },
      },
      {
        test: {
          name: 'contract',
          environment: 'node',
          include: ['tests/contract/**/*.test.ts'],
          alias,
        },
      },
      {
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/**/*.test.ts'],
          alias,
        },
      },
      await defineVitestProject({
        test: {
          name: 'integration',
          environment: 'nuxt',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup/i18n.ts'],
        },
      }),
    ],
  },
}))
