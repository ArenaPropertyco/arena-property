import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Nivel N2 del plan §5. Este archivo solo verifica que el nivel está cableado:
 * las pruebas reales de RLS, restricciones de exclusión y disparadores llegan
 * con las migraciones (paso 3 de tasks.md en adelante).
 *
 * Las que necesitan el motor levantado se saltan solas si `supabase start` no
 * está corriendo, para no dar por buena una verificación que no ocurrió.
 */

const raiz = process.cwd()
const config = resolve(raiz, 'supabase/config.toml')

/**
 * El arranque en frío de Kong tarda varios segundos. Un margen corto hacía que el
 * nivel se saltara solo con el motor levantado, y una prueba de seguridad omitida
 * se lee igual que una en verde: se reintenta antes de darla por ausente.
 */
async function stackLevantado(url: string): Promise<boolean> {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const respuesta = await fetch(`${url}/rest/v1/`, { signal: AbortSignal.timeout(5000) })
      return respuesta.status < 500
    }
    catch {
      await new Promise(listo => setTimeout(listo, 1000))
    }
  }
  return false
}

const urlLocal = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const hayStack = await stackLevantado(urlLocal)

describe('RT-04 · proyecto local de Supabase', () => {
  it('existe la configuración del proyecto', () => {
    expect(existsSync(config)).toBe(true)
  })

  it('la configuración declara el puerto de la API', () => {
    expect(readFileSync(config, 'utf8')).toMatch(/\[api\][\s\S]*?port\s*=\s*\d+/)
  })

  it('las migraciones son el único lugar del esquema', () => {
    expect(existsSync(resolve(raiz, 'supabase/migrations'))).toBe(true)
  })
})

describe.skipIf(!hayStack)('RT-04 · contra el motor levantado', () => {
  it('la API local responde', async () => {
    expect(await stackLevantado(urlLocal)).toBe(true)
  })
})
