import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CatalogFilters from '~/components/CatalogFilters.vue'
import ContactForm from '~/components/ContactForm.vue'
import FloorPlanViewer from '~/components/FloorPlanViewer.vue'
import HomeBenefits from '~/components/HomeBenefits.vue'
import HomeBusinessModel from '~/components/HomeBusinessModel.vue'
import HomeCta from '~/components/HomeCta.vue'
import HomeHero from '~/components/HomeHero.vue'
import HomeProperties from '~/components/HomeProperties.vue'
import OwnerPlansList from '~/components/OwnerPlansList.vue'
import PropertyCard from '~/components/PropertyCard.vue'
import PropertyCatalog from '~/components/PropertyCatalog.vue'
import PropertyContactForm from '~/components/PropertyContactForm.vue'
import { SECCIONES_DE_LA_HOME } from '#shared/content/home'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { PlanDePagosListado } from '#shared/payments/vistas'
import { filtroDeCatalogoVacio } from '#shared/properties/catalogo-publico'
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'

/**
 * HU-00, HU-01, HU-02, HU-03, HU-46 y HU-58 · principio 10 · los componentes del
 * sitio público reciben datos por props y comunican por eventos. La apariencia no
 * se prueba; sí que muestran lo que la spec exige y emiten lo que la página necesita.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

function seccion(id: string) {
  return SECCIONES_DE_LA_HOME.find(s => s.id === id)!
}

function propiedad(cambios: Partial<PropiedadPublica> = {}): PropiedadPublica {
  return {
    id: 'p1',
    slug: 'casa-arena-palomino',
    name: 'Casa Arena Palomino',
    region: 'La Guajira',
    city: 'Palomino',
    country: 'CO',
    visibility: 'published',
    commercial: 'fractions_available',
    lowestPrice: pesos(180_000_000),
    availableFractions: 5,
    fractionCount: 8,
    photoUrl: null,
    areaM2: 120,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpots: 1,
    ...cambios,
  }
}

function plan(cambios: Partial<PlanDePagosListado> = {}): PlanDePagosListado {
  return {
    id: 'plan-1',
    fractionId: 'f-1',
    fractionNumber: 3,
    propertyId: 'p1',
    propertyName: 'Casa Arena Palomino',
    ownerId: 'u-1',
    ownerLabel: 'ana@ejemplo.com',
    agreedPrice: pesos(100_000_000),
    paidTotal: pesos(30_000_000),
    balance: pesos(70_000_000),
    status: 'in_progress',
    calendarActive: false,
    referralCode: null,
    closedAt: '2026-09-01T12:00:00Z',
    voidedAt: null,
    voidReason: null,
    ...cambios,
  }
}

describe('HU-00 · secciones de la home desde el manifiesto', () => {
  it('RF-00.1 · el hero muestra el slogan y el GIF oficial de fondo', async () => {
    const hero = await mountSuspended(HomeHero, { props: { seccion: seccion('hero') } })

    expect(hero.text()).toContain('Sé dueño de Bocagrande')
    expect(hero.find('[data-test="hero-fondo"]').attributes('src')).toBe('/media/hero.gif')
  })

  it('CA-00.4 · con movimiento reducido el hero deja solo el fotograma fijo', async () => {
    const hero = await mountSuspended(HomeHero, { props: { seccion: seccion('hero'), reducirMovimiento: true } })

    expect(hero.find('[data-test="hero-fondo"]').exists()).toBe(false)
    expect(hero.find('img').attributes('src')).toBe('/media/hero-poster.jpg')
  })

  it('RF-00.1 · RF-01.1 · la home muestra las propiedades activas que recibe y manda al catálogo', async () => {
    const seccionPropiedades = await mountSuspended(HomeProperties, {
      props: { seccion: seccion('properties'), propiedades: [propiedad(), propiedad({ id: 'p2', slug: 'invictus', name: 'Invictvs' })] },
    })

    expect(seccionPropiedades.findAll('[data-test^="propiedad-"]')).toHaveLength(2)
    expect(seccionPropiedades.text()).toContain('Invictvs')
    expect(seccionPropiedades.find('[data-test="cta-properties"]').attributes('href')).toBe('/propiedades')
  })

  it('sin propiedades publicadas la sección lo dice con su texto', async () => {
    const seccionPropiedades = await mountSuspended(HomeProperties, { props: { seccion: seccion('properties'), propiedades: [] } })

    expect(seccionPropiedades.find('[data-test="propiedades-vacias"]').text()).toBe('Pronto publicaremos las próximas propiedades.')
  })

  it('RF-00.3 · el modelo de negocio explica en corto y emite su CTA hacia la página de detalle', async () => {
    const modelo = await mountSuspended(HomeBusinessModel, { props: { seccion: seccion('business_model') } })

    expect(modelo.text()).toContain('Eres propietario real')
    await modelo.find('[data-test="cta-business_model"]').trigger('click')
    expect(modelo.emitted('cta')).toEqual([[seccion('business_model')]])
    expect(modelo.find('[data-test="cta-business_model"]').attributes('href')).toBe('/modelo')
  })

  it('RF-00.4 · beneficios lista ventajas del fraccionado frente a una propiedad completa', async () => {
    const beneficios = await mountSuspended(HomeBenefits, { props: { seccion: seccion('benefits') } })

    expect(beneficios.findAll('[data-test="beneficio"]').length).toBeGreaterThanOrEqual(4)
    expect(beneficios.find('[data-test="cta-benefits"]').attributes('href')).toBe('/beneficios')
  })

  it('RF-00.5 · el CTA principal dirige al registro o al catálogo', async () => {
    const cta = await mountSuspended(HomeCta, { props: { seccion: seccion('cta') } })

    expect(['/registro', '/propiedades']).toContain(cta.find('[data-test="cta-cta"]').attributes('href'))
    await cta.find('[data-test="cta-cta"]').trigger('click')
    expect(cta.emitted('cta')).toHaveLength(1)
  })
})

describe('HU-01 · catálogo público', () => {
  it('RF-01.2 · RF-01.4 · la tarjeta muestra nombre, ubicación, precio, estado y ficha resumida', async () => {
    const tarjeta = await mountSuspended(PropertyCard, { props: { propiedad: propiedad() } })

    expect(tarjeta.text()).toContain('Casa Arena Palomino')
    expect(tarjeta.text()).toContain('Palomino')
    expect(tarjeta.text()).toContain(formatearImporte(pesos(180_000_000), 'es'))
    expect(tarjeta.find('[data-test="estado-comercial"]').text()).toBe('Fracciones disponibles')
    expect(tarjeta.text()).toContain('120')
    expect(tarjeta.find('a').attributes('href')).toBe('/propiedades/casa-arena-palomino')
  })

  it('CA-01.3 · sin coincidencias el catálogo muestra el estado vacío traducido', async () => {
    const catalogo = await mountSuspended(PropertyCatalog, { props: { propiedades: [], pendiente: false } })

    expect(catalogo.find('[data-test="catalogo-vacio"]').text()).toBe('No hay propiedades que coincidan con tu búsqueda.')
  })

  it('RF-01.3 · los filtros emiten el filtro completo y se limpian de una vez', async () => {
    const filtros = await mountSuspended(CatalogFilters, {
      props: {
        filtro: { ...filtroDeCatalogoVacio(), region: 'Bolívar' },
        regiones: ['Bolívar', 'La Guajira'],
        rango: { min: pesos(173_000_000), max: pesos(180_000_000) },
        total: 3,
        mostradas: 1,
      },
    })

    await filtros.find('[data-test="filtro-precio-max"] input').setValue('175000000')
    expect(filtros.emitted('update:filtro')?.[0]?.[0]).toMatchObject({ region: 'Bolívar', precioMax: 175_000_000 })

    await filtros.find('[data-test="filtro-lista-espera"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[1]?.[0]).toMatchObject({ listaDeEspera: true })

    await filtros.find('[data-test="limpiar-filtros"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[2]?.[0]).toEqual(filtroDeCatalogoVacio())
  })
})

describe('HU-02 · plano elevado', () => {
  it('CA-02.4 · en modo imagen se muestra el respaldo estático y no hay lienzo 3D', async () => {
    const visor = await mountSuspended(FloorPlanViewer, {
      props: {
        plano: { id: 'm1', kind: 'floor_plan', path: 'p1/floor_plan/plano.png', position: 0, url: 'https://firmada/plano.png' },
        modo: 'imagen',
      },
    })

    expect(visor.find('[data-test="plano-imagen"]').exists()).toBe(true)
    expect(visor.find('canvas').exists()).toBe(false)
  })

  it('sin plano cargado se dice, no se inventa', async () => {
    const visor = await mountSuspended(FloorPlanViewer, { props: { plano: null, modelo: null, modo: 'visor3d' } })

    expect(visor.find('[data-test="sin-plano"]').exists()).toBe(true)
  })

  it('CA-02.4 · con modelo .glb pero en modo imagen se muestra la imagen de respaldo, no el lienzo', async () => {
    const visor = await mountSuspended(FloorPlanViewer, {
      props: {
        plano: { id: 'm1', kind: 'floor_plan', path: 'p1/floor_plan/plano.png', position: 0, url: 'https://firmada/plano.png' },
        modelo: { id: 'm2', kind: 'floor_plan', path: 'p1/floor_plan/apartamento.glb', position: 1, url: 'https://firmada/apartamento.glb' },
        modo: 'imagen',
      },
    })

    expect(visor.find('[data-test="plano-imagen"]').attributes('src')).toContain('plano.png')
    expect(visor.find('canvas').exists()).toBe(false)
  })

  it('RF-02.5 · un modelo sin imagen de respaldo lo dice cuando no hay WebGL', async () => {
    const visor = await mountSuspended(FloorPlanViewer, {
      props: {
        plano: null,
        modelo: { id: 'm2', kind: 'floor_plan', path: 'p1/floor_plan/apartamento.glb', position: 1, url: 'https://firmada/apartamento.glb' },
        modo: 'imagen',
      },
    })

    expect(visor.find('[data-test="sin-respaldo"]').exists()).toBe(true)
    expect(visor.find('canvas').exists()).toBe(false)
  })
})

describe('HU-46 · formulario general de contacto', () => {
  it('CA-46.1 · con correo inválido y requeridos vacíos muestra errores traducidos por campo y no emite', async () => {
    const formulario = await mountSuspended(ContactForm, { props: { enviando: false } })

    await formulario.find('[data-test="campo-email"] input').setValue('sin-arroba')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-email"]').text()).toContain('Escribe un correo válido.')
    expect(formulario.find('[data-test="campo-nombre"]').text()).toContain('Escribe tu nombre.')
    expect(formulario.find('[data-test="campo-intencion"]').text()).toContain('Elige tu intención de compra.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-46.3 · la intención ofrece exactamente 4 opciones con su texto', async () => {
    const formulario = await mountSuspended(ContactForm, { props: { enviando: false } })

    const opciones = formulario.findAll('[data-test="campo-intencion"] [role="radio"]')
    expect(opciones).toHaveLength(4)
    expect(formulario.find('[data-test="campo-intencion"]').text()).toContain('segunda vivienda')
  })

  it('RF-46.6 · el código de referido llega prellenado desde la sesión', async () => {
    const formulario = await mountSuspended(ContactForm, { props: { enviando: false, codigoReferido: 'LUIS-2026' } })

    expect((formulario.find('[data-test="campo-referido"] input').element as HTMLInputElement).value).toBe('LUIS-2026')
  })

  it('CA-46.2 · una solicitud completa se emite normalizada con las tres selecciones', async () => {
    const formulario = await mountSuspended(ContactForm, {
      props: { enviando: false, inicial: { propertyType: 'vacation', incomeRange: 'over_7m' } },
    })

    await formulario.find('[data-test="campo-nombre"] input').setValue(' Ana ')
    await formulario.find('[data-test="campo-apellidos"] input').setValue('Gómez')
    await formulario.find('[data-test="campo-email"] input').setValue('Ana@Ejemplo.com')
    await formulario.find('[data-test="campo-telefono"] input').setValue('+57 310 000 0000')
    await formulario.find('[data-test="campo-mensaje"] textarea').setValue('Quiero conocer el modelo.')
    await formulario.find('[data-test="campo-intencion"] [role="radio"][value="investment"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toEqual({
      firstName: 'Ana',
      lastName: 'Gómez',
      email: 'ana@ejemplo.com',
      phone: '+57 310 000 0000',
      message: 'Quiero conocer el modelo.',
      intent: 'investment',
      propertyType: 'vacation',
      incomeRange: 'over_7m',
      referralCode: null,
      propertyId: null,
    })
  })
})

describe('HU-03 · contacto desde la ficha', () => {
  it('CA-03.2 · un envío válido desde la propiedad P se emite vinculado a P con la intención elegida', async () => {
    const formulario = await mountSuspended(PropertyContactForm, {
      props: { propiedad: { id: 'p-9', name: 'Casa Arena Palomino' }, enviando: false, codigoReferido: null },
    })

    await formulario.find('[data-test="campo-nombre"] input').setValue('Ana')
    await formulario.find('[data-test="campo-apellidos"] input').setValue('Gómez')
    await formulario.find('[data-test="campo-email"] input').setValue('ana@ejemplo.com')
    await formulario.find('[data-test="campo-telefono"] input').setValue('+57 310 000 0000')
    await formulario.find('[data-test="campo-mensaje"] textarea').setValue('¿Cuándo puedo visitarla?')
    await formulario.find('[data-test="campo-intencion"] [role="radio"][value="truly_mine"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ propertyId: 'p-9', intent: 'truly_mine' })
  })

  it('CA-03.1 · sin intención de compra muestra el error traducido y no emite', async () => {
    const formulario = await mountSuspended(PropertyContactForm, {
      props: { propiedad: { id: 'p-9', name: 'Casa Arena Palomino' }, enviando: false, codigoReferido: null },
    })

    await formulario.find('[data-test="campo-email"] input').setValue('ana@ejemplo.com')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-intencion"]').text()).toContain('Elige tu intención de compra.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('RF-03.5 · el código de referido de la sesión llega prellenado y viaja en la solicitud', async () => {
    const formulario = await mountSuspended(PropertyContactForm, {
      props: { propiedad: { id: 'p-9', name: 'Casa' }, enviando: false, codigoReferido: 'LUIS-2026' },
    })

    expect((formulario.find('[data-test="campo-referido"] input').element as HTMLInputElement).value).toBe('LUIS-2026')
  })
})

describe('HU-58 · RF-58.9 · el Propietario lee sus planes', () => {
  it('RF-58.9 · cada plan muestra el saldo pendiente y qué falta para activar el calendario', async () => {
    const lista = await mountSuspended(OwnerPlansList, { props: { planes: [plan()], pendiente: false } })

    expect(lista.text()).toContain('Casa Arena Palomino')
    const saldo = formatearImporte(pesos(70_000_000), 'es')
    expect(lista.find('[data-test="saldo-plan-1"]').text()).toContain(saldo)
    expect(lista.find('[data-test="calendario-plan-1"]').text()).toBe(`Faltan ${saldo} para activar el calendario.`)
    expect(lista.find('[data-test="abrir-plan-1"]').attributes('href')).toBe('/panel/planes/plan-1')
  })

  it('RF-58.9 · un plan completo dice que el calendario está activo', async () => {
    const lista = await mountSuspended(OwnerPlansList, {
      props: { planes: [plan({ paidTotal: pesos(100_000_000), balance: pesos(0), status: 'completed', calendarActive: true })], pendiente: false },
    })

    expect(lista.find('[data-test="calendario-plan-1"]').text()).toContain('activo')
  })

  it('sin fracciones propias lo dice con su texto', async () => {
    const lista = await mountSuspended(OwnerPlansList, { props: { planes: [], pendiente: false } })

    expect(lista.find('[data-test="sin-planes"]').text()).toBe('Todavía no tienes fracciones con plan de pagos.')
  })
})
