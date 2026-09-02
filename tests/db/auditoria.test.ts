import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

/**
 * TR-01 · nivel N2 visto desde la aplicación.
 *
 * Lo que garantiza el motor se prueba en `supabase/tests/` con pgTAP, que puede
 * crear tablas y forzar fallos dentro de una transacción. Aquí se comprueba lo que
 * ve un cliente real a través de la API: que el registro no se puede reescribir ni
 * leer sin rol, que es la superficie por la que llegaría un abuso.
 */

const url = process.env.NUXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const claveAnonima = process.env.NUXT_PUBLIC_SUPABASE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

async function stackLevantado(): Promise<boolean> {
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

const hayStack = await stackLevantado()
const anonimo = createClient(url, claveAnonima)

describe.skipIf(!hayStack)('TR-01 · el registro visto desde la API', () => {
  it('RF-A.6 · un cliente anónimo no obtiene ninguna entrada', async () => {
    const { data, error } = await anonimo.from('audit_log').select('id')

    // O bien lo rechaza, o bien no devuelve nada: en ningún caso entrega datos.
    expect(error ?? data).not.toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('CA-A.2 · un cliente anónimo no puede actualizar el registro', async () => {
    const { data, error } = await anonimo
      .from('audit_log')
      .update({ reason: 'reescrito' })
      .eq('entity_type', 'property')
      .select()

    expect(data ?? []).toEqual([])
    if (error) {
      expect(error.message).toBeTruthy()
    }
  })

  it('CA-A.2 · un cliente anónimo no puede borrar el registro', async () => {
    const { data, error } = await anonimo
      .from('audit_log')
      .delete()
      .eq('entity_type', 'property')
      .select()

    expect(data ?? []).toEqual([])
    if (error) {
      expect(error.message).toBeTruthy()
    }
  })

  it('RF-A.4 · el catálogo de acciones que exigen motivo no es escribible desde la API', async () => {
    const { data, error } = await anonimo
      .from('audit_reason_required')
      .insert({ action: 'colada.por_la_api', source: 'ninguna' })
      .select()

    expect(data ?? []).toEqual([])
    expect(error).not.toBeNull()
  })
})
