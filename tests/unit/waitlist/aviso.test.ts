import { describe, expect, it } from 'vitest'
import { destinatariosDeLiberacion } from '#shared/waitlist/aviso'
import type { InscritoEnEspera } from '#shared/waitlist/aviso'
import { plantillaDeListaDeEspera } from '#shared/waitlist/correos'

/**
 * HU-47 · RF-47.4 — cuando una fracción vuelve a estar disponible se avisa a la
 * lista en orden de inscripción y una sola vez por persona. La base aplica la
 * misma regla en su disparador; aquí vive para probarla sin infraestructura.
 */

function inscrito(cambios: Partial<InscritoEnEspera> = {}): InscritoEnEspera {
  return { id: 'w-1', email: 'ana@ejemplo.com', createdAt: '2026-09-01T10:00:00Z', notifiedAt: null, ...cambios }
}

describe('CA-47.4 · a quién se avisa y en qué orden', () => {
  it('CA-47.4 · en orden de inscripción, aunque lleguen desordenados', () => {
    const lista = [
      inscrito({ id: 'w-3', email: 'c@ejemplo.com', createdAt: '2026-09-03T10:00:00Z' }),
      inscrito({ id: 'w-1', email: 'a@ejemplo.com', createdAt: '2026-09-01T10:00:00Z' }),
      inscrito({ id: 'w-2', email: 'b@ejemplo.com', createdAt: '2026-09-02T10:00:00Z' }),
    ]
    expect(destinatariosDeLiberacion(lista).map(i => i.id)).toEqual(['w-1', 'w-2', 'w-3'])
  })

  it('CA-47.4 · a quien ya se le avisó no se le vuelve a avisar', () => {
    const lista = [
      inscrito({ id: 'w-1', notifiedAt: '2026-09-05T10:00:00Z' }),
      inscrito({ id: 'w-2', email: 'b@ejemplo.com', createdAt: '2026-09-02T10:00:00Z' }),
    ]
    expect(destinatariosDeLiberacion(lista).map(i => i.id)).toEqual(['w-2'])
  })

  it('CA-47.4 · una sola vez por persona: el mismo correo con dos filas recibe un aviso', () => {
    const lista = [
      inscrito({ id: 'w-1', email: 'ana@ejemplo.com', createdAt: '2026-09-01T10:00:00Z' }),
      inscrito({ id: 'w-9', email: 'ANA@ejemplo.com', createdAt: '2026-09-09T10:00:00Z' }),
    ]
    expect(destinatariosDeLiberacion(lista).map(i => i.id)).toEqual(['w-1'])
  })

  it('no muta la lista que recibe', () => {
    const lista = [inscrito({ id: 'w-2', createdAt: '2026-09-02T10:00:00Z' }), inscrito({ id: 'w-1' })]
    destinatariosDeLiberacion(lista)
    expect(lista.map(i => i.id)).toEqual(['w-2', 'w-1'])
  })
})

describe('RF-47.3 · RF-47.4 · los correos de la lista, en los dos idiomas', () => {
  it('la confirmación nombra la propiedad y la liberación también, sin marcadores sueltos', () => {
    const confirmacion = plantillaDeListaDeEspera('confirmation', 'es', { property_name: 'Villa Arena' })
    expect(confirmacion.asunto).toContain('Villa Arena')
    expect(confirmacion.texto).not.toMatch(/\{[a-z_]+\}/)

    const liberacion = plantillaDeListaDeEspera('release', 'en', { property_name: 'Villa Arena', property_url: 'https://arena/p/villa' })
    expect(liberacion.texto).toContain('https://arena/p/villa')
    expect(liberacion.texto).not.toMatch(/\{[a-z_]+\}/)
  })
})
