import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AboutFaq from '~/components/AboutFaq.vue'
import AmbassadorCommissionHighlight from '~/components/AmbassadorCommissionHighlight.vue'
import AmbassadorTerms from '~/components/AmbassadorTerms.vue'
import BenefitsComparison from '~/components/BenefitsComparison.vue'
import ContentCta from '~/components/ContentCta.vue'
import ModelPurchasePath from '~/components/ModelPurchasePath.vue'
import SchedulingSeasons from '~/components/SchedulingSeasons.vue'
import WaitlistForm from '~/components/WaitlistForm.vue'
import { SECCIONES_DE_AGENDAMIENTO } from '#shared/content/agendamiento'
import { COMPARATIVO, PRECIO_DE_FRACCION, PRECIO_DEL_APARTAMENTO, SECCIONES_DE_BENEFICIOS } from '#shared/content/beneficios'
import { comisionPublicada, RUTA_DE_INSCRIPCION, SECCIONES_DE_EMBAJADORES } from '#shared/content/embajadores'
import { SECCIONES_DEL_MODELO } from '#shared/content/modelo'
import { PREGUNTAS_FRECUENTES, SECCIONES_DE_NOSOTROS } from '#shared/content/nosotros'
import { formatearImporte, formatearPorcentaje } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { CommissionType } from '#shared/referrals/commission'

/**
 * HU-41, HU-42, HU-43, HU-44, HU-47, HU-48 · principio 10 — los componentes de
 * las subpáginas institucionales reciben el manifiesto y los datos ya resueltos,
 * y emiten lo que la página necesita. La apariencia no se prueba.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

function seccion(secciones: readonly { id: string }[], id: string) {
  return secciones.find(s => s.id === id)!
}

function tipo(cambios: Partial<CommissionType> = {}): CommissionType {
  return { id: 't1', name: 'Base', kind: 'percentage', amount: null, basisPoints: 300, isDefault: true, active: true, createdBy: null, createdAt: '', ...cambios }
}

describe('HU-42 · comparativo', () => {
  it('CA-42.2 · la cifra estimada sale en rojo y marcada como estimada; la confirmada, en verde', async () => {
    const comparativo = await mountSuspended(BenefitsComparison, { props: { seccion: seccion(SECCIONES_DE_BENEFICIOS, 'comparison') } })

    const tradicional = comparativo.find('[data-test="celda-capital-traditional"]')
    expect(tradicional.text()).toContain(formatearImporte(PRECIO_DEL_APARTAMENTO, 'es'))
    expect(tradicional.find('.font-mono').classes()).toContain('text-error')
    expect(comparativo.find('[data-test="condicion-capital-traditional"]').text()).toBe('Estimado')

    const fraccion = comparativo.find('[data-test="celda-capital-fractional"]')
    expect(fraccion.text()).toContain(formatearImporte(PRECIO_DE_FRACCION, 'es'))
    expect(fraccion.find('.font-mono').classes()).toContain('text-success')
    expect(comparativo.find('[data-test="condicion-capital-fractional"]').text()).toBe('Confirmado')
  })

  it('CA-42.1 · RF-42.1 · pinta una fila por criterio con las dos columnas', async () => {
    const comparativo = await mountSuspended(BenefitsComparison, { props: { seccion: seccion(SECCIONES_DE_BENEFICIOS, 'comparison') } })

    expect(comparativo.findAll('[data-test^="fila-"]')).toHaveLength(COMPARATIVO.length)
    expect(comparativo.find('[data-test="celda-usage-fractional"]').text()).toContain('42 noches')
  })
})

describe('HU-43 · temporadas', () => {
  it('CA-43.1 · la tabla publica 7/7/7/21 noches, 42 en total y la semana completa como mínimo', async () => {
    const tabla = await mountSuspended(SchedulingSeasons, { props: { seccion: seccion(SECCIONES_DE_AGENDAMIENTO, 'seasons') } })

    expect(tabla.findAll('[data-test^="temporada-"]')).toHaveLength(4)
    expect(['alta', 'media_alta', 'media', 'baja'].map(id => tabla.find(`[data-test="noches-${id}"]`).text())).toEqual(['7', '7', '7', '21'])
    expect(tabla.find('[data-test="noches-total"]').text()).toBe('42')
    expect(tabla.find('[data-test="temporada-alta"]').text()).toContain('Semana completa')
  })
})

describe('HU-41 · camino de compra', () => {
  it('RF-41.2 · muestra los cinco pasos con el rol de cada uno, de Visitante a Propietario', async () => {
    const camino = await mountSuspended(ModelPurchasePath, { props: { seccion: seccion(SECCIONES_DEL_MODELO, 'path') } })

    expect(camino.findAll('[data-test^="paso-"]')).toHaveLength(5)
    expect(camino.find('[data-test="rol-explore"]').text()).toBe('Visitante')
    expect(camino.find('[data-test="rol-own"]').text()).toBe('Propietario')
  })
})

describe('HU-44 · preguntas frecuentes', () => {
  it('CA-44.2 · el acordeón recorre la estructura tipada completa', async () => {
    const faq = await mountSuspended(AboutFaq, { props: { seccion: seccion(SECCIONES_DE_NOSOTROS, 'faq') } })

    for (const pregunta of PREGUNTAS_FRECUENTES) {
      expect(faq.text()).toContain(pregunta.id === 'what_is' ? 'exactamente una fracción' : '¿')
    }
    expect(faq.findAll('button').length).toBeGreaterThanOrEqual(PREGUNTAS_FRECUENTES.length)
  })
})

describe('HU-48 · comisión vigente y CTA por sesión', () => {
  const comision = seccion(SECCIONES_DE_EMBAJADORES, 'commission')

  it('CA-48.1 · un tipo porcentual se muestra con su porcentaje formateado', async () => {
    const bloque = await mountSuspended(AmbassadorCommissionHighlight, { props: { seccion: comision, comision: comisionPublicada(tipo(), 'es') } })

    expect(bloque.find('[data-test="comision-vigente"]').text()).toBe(formatearPorcentaje(300, 'es'))
    expect(bloque.find('[data-test="comision-nota"]').text()).toContain('precio pactado')
  })

  it('CA-48.1 · un tipo de importe fijo se muestra como importe en pesos', async () => {
    const fijo = comisionPublicada(tipo({ kind: 'fixed', amount: pesos(1_500_000), basisPoints: null }), 'es')
    const bloque = await mountSuspended(AmbassadorCommissionHighlight, { props: { seccion: comision, comision: fijo } })

    expect(bloque.find('[data-test="comision-vigente"]').text()).toBe(formatearImporte(pesos(1_500_000), 'es'))
  })

  it('RF-48.2 · sin tipo predeterminado lo dice en vez de inventar una cifra', async () => {
    const bloque = await mountSuspended(AmbassadorCommissionHighlight, { props: { seccion: comision, comision: null } })

    expect(bloque.find('[data-test="comision-vigente"]').exists()).toBe(false)
    expect(bloque.find('[data-test="comision-no-disponible"]').exists()).toBe(true)
  })

  it('RF-48.3 · las condiciones citan la ventana de 90 días y los 30 de gracia desde el dominio', async () => {
    const condiciones = await mountSuspended(AmbassadorTerms, { props: { seccion: seccion(SECCIONES_DE_EMBAJADORES, 'terms') } })

    expect(condiciones.find('[data-test="condicion-window"]').text()).toContain('90')
    expect(condiciones.find('[data-test="condicion-grace"]').text()).toContain('30')
  })

  it('CA-48.2 · el CTA respeta el destino que la página decide por sesión y lo emite', async () => {
    const cta = seccion(SECCIONES_DE_EMBAJADORES, 'cta')
    const sinSesion = await mountSuspended(ContentCta, { props: { seccion: cta, descriptionKey: 'ambassadors.cta.description' } })
    expect(sinSesion.find('[data-test="cta-cta"]').attributes('href')).toBe('/registro')

    const conSesion = await mountSuspended(ContentCta, { props: { seccion: cta, descriptionKey: 'ambassadors.cta.signedIn', destino: RUTA_DE_INSCRIPCION } })
    expect(conSesion.find('[data-test="cta-cta"]').attributes('href')).toBe('/panel/embajador')
    await conSesion.find('[data-test="cta-cta"]').trigger('click')
    expect(conSesion.emitted('cta')).toEqual([[cta, '/panel/embajador']])
  })
})

describe('HU-47 · formulario de lista de espera', () => {
  const props = { propiedad: { id: 'a4700000-0000-4000-8000-000000000001', name: 'Villa Espera' }, enviando: false }

  it('CA-47.1 · RF-47.5 · sin consentimiento no se envía y se explica', async () => {
    const formulario = await mountSuspended(WaitlistForm, { props })

    Object.assign(formulario.vm.estado, { fullName: 'Ana', email: 'ana@ejemplo.com', phone: '+57 310' })
    await formulario.find('[data-test="formulario-lista-de-espera"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-espera-consentimiento"]').text()).toContain('consentimiento')
  })

  it('CA-47.3 · una inscripción completa se emite normalizada y vinculada a la propiedad', async () => {
    const formulario = await mountSuspended(WaitlistForm, { props })

    Object.assign(formulario.vm.estado, { fullName: ' Ana Gómez ', email: 'Ana@Ejemplo.com', phone: '+57 310', consent: true })
    await formulario.find('[data-test="formulario-lista-de-espera"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toEqual({
      propertyId: 'a4700000-0000-4000-8000-000000000001',
      fullName: 'Ana Gómez',
      email: 'ana@ejemplo.com',
      phone: '+57 310',
      consent: true,
    })
  })
})
