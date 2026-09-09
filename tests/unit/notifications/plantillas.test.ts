import { describe, expect, it } from 'vitest'
import { IDIOMAS, idiomaDe, plantillaDe } from '#shared/notifications/plantillas'
import { TIPOS_DE_NOTIFICACION } from '#shared/notifications/tipos'

/**
 * TR-03 · RF-N.2 · RT-05 — cada tipo de notificación tiene plantilla de correo en
 * `es` y en `en`, y se elige por el idioma del destinatario.
 */

const carga = { property_name: 'Invictvs', fraction_number: 3, title: 'Corte de agua', amount: '$ 5.000.000', available_on: '2026-10-08' }

describe('RF-N.2 · plantillas de correo por tipo e idioma', () => {
  it.each(TIPOS_DE_NOTIFICACION)('%s tiene plantilla con asunto y texto en los dos idiomas', (tipo) => {
    for (const idioma of IDIOMAS) {
      const plantilla = plantillaDe(tipo, idioma, carga)
      expect(plantilla.asunto.trim().length, `${tipo}/${idioma} asunto`).toBeGreaterThan(0)
      expect(plantilla.texto.trim().length, `${tipo}/${idioma} texto`).toBeGreaterThan(0)
      expect(plantilla.texto, `${tipo}/${idioma} sin marcadores sueltos`).not.toMatch(/\{[a-z_]+\}/)
    }
  })

  it('el mismo tipo produce textos distintos por idioma', () => {
    expect(plantillaDe('calendar_activated', 'es', carga).asunto).not.toBe(plantillaDe('calendar_activated', 'en', carga).asunto)
  })

  it('la plantilla interpola la carga del evento', () => {
    expect(plantillaDe('announcement_published', 'es', carga).texto).toContain('Corte de agua')
    expect(plantillaDe('referral_paid', 'en', carga).texto).toContain('$ 5.000.000')
  })

  it('RT-05 · el idioma del destinatario se respeta y lo desconocido cae en español', () => {
    expect(idiomaDe('en')).toBe('en')
    expect(idiomaDe('es')).toBe('es')
    expect(idiomaDe('fr')).toBe('es')
    expect(idiomaDe(null)).toBe('es')
  })
})
