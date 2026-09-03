import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FractionTransferForm from '~/components/FractionTransferForm.vue'
import FractionsTable from '~/components/FractionsTable.vue'
import PropertiesTable from '~/components/PropertiesTable.vue'
import PropertyFilters from '~/components/PropertyFilters.vue'
import PropertyForm from '~/components/PropertyForm.vue'
import PropertyMediaGallery from '~/components/PropertyMediaGallery.vue'
import PropertyStateBadge from '~/components/PropertyStateBadge.vue'
import PropertyStateActions from '~/components/PropertyStateActions.vue'
import type { FraccionListada } from '#shared/properties/vistas'
import { filtroVacio } from '#shared/properties/catalogo'

/**
 * HU-08…HU-11 · principio 10 · los componentes de propiedades reciben datos por
 * props y comunican por eventos. Ninguno consulta Supabase ni decide permisos:
 * qué acciones se ofrecen sale de las tablas de transiciones de `shared/`.
 */

const PROPIEDAD = 'a5000000-0000-4000-8000-000000000001'

function fraccion(cambios: Partial<FraccionListada> & { number: number }): FraccionListada {
  return {
    id: `f-${cambios.number}`,
    propertyId: PROPIEDAD,
    listPrice: 180_000_000,
    status: 'available',
    ownerId: null,
    ownerLabel: null,
    calendarActive: false,
    ...cambios,
  }
}

describe('PropertyStateBadge', () => {
  it('RF-08.2 · nombra la visibilidad con la etiqueta del manual', async () => {
    const insignia = await mountSuspended(PropertyStateBadge, {
      props: { visibility: 'draft', commercial: null },
    })

    expect(insignia.find('[data-test="estado-visibilidad"]').text()).toBe('En borrador')
  })

  it('RF-08.3 · muestra el estado comercial derivado cuando existe', async () => {
    const insignia = await mountSuspended(PropertyStateBadge, {
      props: { visibility: 'published', commercial: 'sold_out' },
    })

    expect(insignia.find('[data-test="estado-comercial"]').text()).toBe('Vendido')
  })

  it('RF-08.3 · una propiedad sin fraccionar no finge tener estado comercial', async () => {
    const insignia = await mountSuspended(PropertyStateBadge, {
      props: { visibility: 'draft', commercial: null },
    })

    expect(insignia.find('[data-test="estado-comercial"]').text()).toBe('Sin fraccionar')
  })
})

describe('PropertyStateActions', () => {
  it('CA-08.1 · en borrador solo ofrece publicar', async () => {
    const acciones = await mountSuspended(PropertyStateActions, {
      props: { visibility: 'draft', comingSoon: true, fraccionada: false },
    })

    expect(acciones.find('[data-test="accion-published"]').exists()).toBe(true)
    expect(acciones.find('[data-test="accion-inactive"]').exists()).toBe(false)
  })

  it('CA-08.1 · publicada ofrece inactivar y no volver a borrador', async () => {
    const acciones = await mountSuspended(PropertyStateActions, {
      props: { visibility: 'published', comingSoon: true, fraccionada: false },
    })

    expect(acciones.find('[data-test="accion-inactive"]').exists()).toBe(true)
    expect(acciones.find('[data-test="accion-draft"]').exists()).toBe(false)
  })

  it('CA-08.1 · emite la transición pedida, sin ejecutarla', async () => {
    const acciones = await mountSuspended(PropertyStateActions, {
      props: { visibility: 'published', comingSoon: true, fraccionada: false },
    })

    await acciones.find('[data-test="accion-inactive"]').trigger('click')

    expect(acciones.emitted('visibilidad')).toEqual([['inactive']])
  })

  it('RF-08.3 · sin las 8 fracciones no se puede poner a la venta', async () => {
    const acciones = await mountSuspended(PropertyStateActions, {
      props: { visibility: 'published', comingSoon: true, fraccionada: false },
    })

    expect(acciones.find('[data-test="accion-release"]').attributes('disabled')).toBeDefined()
  })

  it('RF-08.3 · fraccionada y en «Próximamente», sí', async () => {
    const acciones = await mountSuspended(PropertyStateActions, {
      props: { visibility: 'published', comingSoon: true, fraccionada: true },
    })

    await acciones.find('[data-test="accion-release"]').trigger('click')

    expect(acciones.emitted('salirDeProximamente')).toHaveLength(1)
  })

  it('RF-08.3 · ya a la venta, la acción desaparece: no hay vuelta a «Próximamente»', async () => {
    const acciones = await mountSuspended(PropertyStateActions, {
      props: { visibility: 'published', comingSoon: false, fraccionada: true },
    })

    expect(acciones.find('[data-test="accion-release"]').exists()).toBe(false)
  })
})

const ficha = {
  name: 'Casa Arena Palomino',
  areaM2: 240,
  bedrooms: 4,
  bathrooms: 3,
  parkingSpots: 2,
  description: 'Casa frente al mar con terraza, piscina privada y acceso directo a la playa, '
    + 'distribuida en dos niveles con cocina integral equipada.',
  amenities: ['Piscina', 'Wifi'],
  location: { country: 'CO', region: 'La Guajira', city: 'Palomino', address: null },
  videoUrl: null,
  floorPlanPath: null,
}

describe('PropertyForm', () => {
  it('CA-08.3 · con campos fuera de rango muestra el error traducido y no emite', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { fotos: 1, guardando: false },
    })

    await formulario.find('[data-test="campo-nombre"] input').setValue('Casa')
    await formulario.find('[data-test="campo-area"] input').setValue('0')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.text()).toContain('Los metros cuadrados deben ser mayores que cero.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-08.3 · RF-08.1 · sin ninguna foto la ficha no se da por completa', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: ficha, fotos: 0, guardando: false },
    })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.text()).toContain('Sube al menos una foto.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('RF-08.1 · con una ficha completa emite los datos ya normalizados', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: { ...ficha, name: '  Casa Arena Palomino  ' }, fotos: 3, guardando: false },
    })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    const emitido = formulario.emitted('submit')?.[0]?.[0] as typeof ficha
    expect(emitido.name).toBe('Casa Arena Palomino')
    expect(emitido.location.country).toBe('CO')
  })

  it('RF-08.1 · el equipamiento se escribe separado por comas y se guarda como lista', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: ficha, fotos: 1, guardando: false },
    })

    await formulario.find('[data-test="campo-equipamiento"] input').setValue('Piscina, Wifi , Piscina')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect((formulario.emitted('submit')?.[0]?.[0] as typeof ficha).amenities).toEqual(['Piscina', 'Wifi'])
  })
})

/**
 * HU-05 · RF-05.1 y RF-05.2 — el Superadmin asigna y retira administradores desde
 * la misma ficha, al crear y al editar. Para cualquier otro rol el control no
 * existe: la política de `property_admins` ya lo impide, y ofrecerlo sería mentir.
 */
describe('PropertyForm · administradores de la propiedad', () => {
  const candidatos = [
    { id: 'admin-1', label: 'ana@arena.co' },
    { id: 'admin-2', label: 'luis@arena.co' },
  ]

  it('CA-05.1 · a quien no es Superadmin no se le ofrece el control', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: ficha, fotos: 1, guardando: false, administradores: candidatos, puedeAsignar: false },
    })

    expect(formulario.find('[data-test="campo-administradores"]').exists()).toBe(false)
  })

  it('RF-05.1 · al Superadmin se le listan las cuentas con rol Administrador', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: ficha, fotos: 1, guardando: false, administradores: candidatos, puedeAsignar: true },
    })

    const control = formulario.find('[data-test="campo-administradores"]')
    expect(control.exists()).toBe(true)
    expect(control.text()).toContain('ana@arena.co')
    expect(control.text()).toContain('luis@arena.co')
  })

  it('RF-05.1 · las asignaciones vigentes llegan ya marcadas', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: {
        modelo: ficha,
        fotos: 1,
        guardando: false,
        administradores: candidatos,
        asignados: ['admin-2'],
        puedeAsignar: true,
      },
    })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[1]).toEqual(['admin-2'])
  })

  it('RF-05.1 · marcar una cuenta la incluye en lo que se emite', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: ficha, fotos: 1, guardando: false, administradores: candidatos, puedeAsignar: true },
    })

    await formulario.find('[data-test="administrador-admin-1"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[1]).toEqual(['admin-1'])
  })

  it('RF-05.2 · desmarcar a quien la administraba emite la lista sin esa cuenta', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: {
        modelo: ficha,
        fotos: 1,
        guardando: false,
        administradores: candidatos,
        asignados: ['admin-1', 'admin-2'],
        puedeAsignar: true,
      },
    })

    await formulario.find('[data-test="administrador-admin-1"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[1]).toEqual(['admin-2'])
  })

  it('RF-05.2 · dejar la lista vacía es válido: se retira a todos', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: {
        modelo: ficha,
        fotos: 1,
        guardando: false,
        administradores: candidatos,
        asignados: ['admin-1'],
        puedeAsignar: true,
      },
    })

    await formulario.find('[data-test="administrador-admin-1"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[1]).toEqual([])
  })

  it('sin candidatos, el Superadmin ve por qué y no un hueco', async () => {
    const formulario = await mountSuspended(PropertyForm, {
      props: { modelo: ficha, fotos: 1, guardando: false, administradores: [], puedeAsignar: true },
    })

    expect(formulario.find('[data-test="sin-administradores"]').text())
      .toContain('Todavía no hay cuentas con rol Administrador.')
  })
})

describe('PropertiesTable', () => {
  const propiedades = [
    {
      id: PROPIEDAD,
      name: 'Casa Palomino',
      region: 'La Guajira',
      visibility: 'published' as const,
      commercial: 'fractions_available' as const,
      adminIds: ['admin-1'],
      adminLabel: 'admin1@arena.co',
      availableFractions: 5,
      fractionCount: 8,
    },
  ]

  it('RF-10.1 · lista las propiedades con su administrador y su estado', async () => {
    const tabla = await mountSuspended(PropertiesTable, {
      props: { propiedades, pendiente: false },
    })

    expect(tabla.text()).toContain('Casa Palomino')
    expect(tabla.text()).toContain('admin1@arena.co')
    expect(tabla.text()).toContain('Fracciones disponibles')
  })

  it('RF-10.1 · una propiedad sin administrador se dice, no se deja en blanco', async () => {
    const tabla = await mountSuspended(PropertiesTable, {
      props: {
        propiedades: [{ ...propiedades[0]!, adminIds: [], adminLabel: null }],
        pendiente: false,
      },
    })

    expect(tabla.text()).toContain('Sin administrador')
  })

  it('la tabla emite qué propiedad se quiere abrir; no navega por su cuenta', async () => {
    const tabla = await mountSuspended(PropertiesTable, {
      props: { propiedades, pendiente: false },
    })

    await tabla.find('[data-test="abrir-propiedad"]').trigger('click')

    expect(tabla.emitted('abrir')).toEqual([[PROPIEDAD]])
  })
})

describe('PropertyFilters', () => {
  it('CA-10.2 · el criterio de región activo se ve en su control', async () => {
    const filtros = await mountSuspended(PropertyFilters, {
      props: {
        filtro: { ...filtroVacio(), region: 'La Guajira' },
        regiones: ['Bolívar', 'La Guajira'],
        administradores: [{ id: 'admin-1', label: 'admin1@arena.co' }],
        total: 3,
        mostradas: 1,
      },
    })

    expect(filtros.find('[data-test="filtro-region"]').text()).toContain('La Guajira')
  })

  it('CA-10.2 · escribir en la búsqueda emite el filtro completo, no solo el texto', async () => {
    const filtros = await mountSuspended(PropertyFilters, {
      props: {
        filtro: { ...filtroVacio(), region: 'La Guajira' },
        regiones: ['La Guajira'],
        administradores: [],
        total: 3,
        mostradas: 1,
      },
    })

    await filtros.find('[data-test="filtro-texto"] input').setValue('palomino')

    const ultimo = filtros.emitted('update:filtro')?.at(-1)?.[0] as Record<string, unknown>
    expect(ultimo).toMatchObject({ texto: 'palomino', region: 'La Guajira' })
  })

  it('RF-10.2 · limpiar devuelve un filtro vacío', async () => {
    const filtros = await mountSuspended(PropertyFilters, {
      props: {
        filtro: { ...filtroVacio(), region: 'La Guajira' },
        regiones: ['La Guajira'],
        administradores: [],
        total: 3,
        mostradas: 1,
      },
    })

    await filtros.find('[data-test="limpiar-filtros"]').trigger('click')

    expect(filtros.emitted('update:filtro')?.at(-1)?.[0]).toEqual(filtroVacio())
  })

  it('RF-10.2 · sin filtro activo no se ofrece limpiar', async () => {
    const filtros = await mountSuspended(PropertyFilters, {
      props: {
        filtro: filtroVacio(),
        regiones: [],
        administradores: [],
        total: 3,
        mostradas: 3,
      },
    })

    expect(filtros.find('[data-test="limpiar-filtros"]').exists()).toBe(false)
  })
})

describe('FractionsTable', () => {
  const ocho = Array.from({ length: 8 }, (_, indice) => fraccion({ number: indice + 1 }))

  it('CA-09.1 · muestra las 8 fracciones numeradas 1/8…8/8', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: { fracciones: ocho, puedeGestionar: true, esSuperadmin: false },
    })

    expect(tabla.text()).toContain('1/8')
    expect(tabla.text()).toContain('8/8')
  })

  it('TR-02 · el precio se presenta como cifra en COP, sin decimales', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: { fracciones: [fraccion({ number: 1 })], puedeGestionar: true, esSuperadmin: false },
    })

    expect(tabla.find('[data-test="precio-fraccion-1"]').text()).not.toContain(',00')
    expect(tabla.find('[data-test="precio-fraccion-1"]').text()).toContain('180')
  })

  it('CA-09.3 · una fracción disponible solo ofrece reservarla', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: { fracciones: [fraccion({ number: 1 })], puedeGestionar: true, esSuperadmin: false },
    })

    expect(tabla.find('[data-test="fraccion-1-reserved"]').exists()).toBe(true)
    expect(tabla.find('[data-test="fraccion-1-sold"]').exists()).toBe(false)
  })

  it('CA-09.3 · una reservada ofrece liberarla o venderla', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [fraccion({ number: 1, status: 'reserved' })],
        puedeGestionar: true,
        esSuperadmin: false,
      },
    })

    expect(tabla.find('[data-test="fraccion-1-available"]').exists()).toBe(true)
    expect(tabla.find('[data-test="fraccion-1-sold"]').exists()).toBe(true)
  })

  it('CA-09.3 · una vendida no ofrece a nadie devolverla a disponible…', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [fraccion({ number: 1, status: 'sold', ownerId: 'u1', ownerLabel: 'ana@ejemplo.com' })],
        puedeGestionar: true,
        esSuperadmin: false,
      },
    })

    expect(tabla.find('[data-test="fraccion-1-available"]').exists()).toBe(false)
    expect(tabla.find('[data-test="fraccion-1-traspaso"]').exists()).toBe(false)
  })

  it('CA-09.3 · …salvo al Superadmin (D-17, D-31)', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [fraccion({ number: 1, status: 'sold', ownerId: 'u1', ownerLabel: 'ana@ejemplo.com' })],
        puedeGestionar: true,
        esSuperadmin: true,
      },
    })

    expect(tabla.find('[data-test="fraccion-1-available"]').exists()).toBe(true)
    expect(tabla.find('[data-test="fraccion-1-traspaso"]').exists()).toBe(true)
  })

  it('CA-09.3 · emite la transición pedida sin decidirla', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: { fracciones: [fraccion({ number: 1 })], puedeGestionar: true, esSuperadmin: false },
    })

    await tabla.find('[data-test="fraccion-1-reserved"]').trigger('click')

    expect(tabla.emitted('transicion')).toEqual([[{ id: 'f-1', estado: 'reserved' }]])
  })

  it('quien solo mira no recibe ninguna acción', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: { fracciones: ocho, puedeGestionar: false, esSuperadmin: false },
    })

    expect(tabla.find('[data-test="fraccion-1-reserved"]').exists()).toBe(false)
  })

  it('D-31 · el interruptor de calendario se muestra, no se edita', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [fraccion({ number: 1, status: 'sold', ownerId: 'u1', ownerLabel: 'ana@ejemplo.com' })],
        puedeGestionar: true,
        esSuperadmin: true,
      },
    })

    expect(tabla.find('[data-test="calendario-fraccion-1"]').text()).toBe('Inactivo')
    expect(tabla.find('[data-test="calendario-fraccion-1"] input').exists()).toBe(false)
  })

  it('D-16 · una fracción vendida muestra a su titular; una libre dice que no lo tiene', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [
          fraccion({ number: 1, status: 'sold', ownerId: 'u1', ownerLabel: 'ana@ejemplo.com' }),
          fraccion({ number: 2 }),
        ],
        puedeGestionar: true,
        esSuperadmin: false,
      },
    })

    expect(tabla.text()).toContain('ana@ejemplo.com')
    expect(tabla.text()).toContain('Sin titular')
  })
})

describe('FractionTransferForm', () => {
  const vendida = fraccion({ number: 3, status: 'sold', ownerId: 'u1', ownerLabel: 'ana@ejemplo.com' })

  it('CA-09.5 · sin motivo no emite y lo dice', async () => {
    const formulario = await mountSuspended(FractionTransferForm, {
      props: { fraccion: vendida, candidatos: [{ id: 'u2', label: 'luis@ejemplo.com' }], enviando: false },
    })

    await formulario.find('[role="radio"][value="u2"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.text()).toContain('El traspaso no se registra sin motivo.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-09.5 · sin nuevo titular tampoco', async () => {
    const formulario = await mountSuspended(FractionTransferForm, {
      props: { fraccion: vendida, candidatos: [], enviando: false },
    })

    await formulario.find('[data-test="campo-motivo"] textarea').setValue('Cesión firmada.')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.text()).toContain('Elige un nuevo titular distinto del actual.')
  })

  it('CA-09.5 · completo, emite la solicitud con los dos destinos resueltos', async () => {
    const formulario = await mountSuspended(FractionTransferForm, {
      props: { fraccion: vendida, candidatos: [{ id: 'u2', label: 'luis@ejemplo.com' }], enviando: false },
    })

    await formulario.find('[role="radio"][value="u2"]').trigger('click')
    await formulario.find('[data-test="campo-motivo"] textarea').setValue('Cesión firmada ante notaría.')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({
      fractionId: 'f-3',
      previousOwnerId: 'u1',
      newOwnerId: 'u2',
      bookings: 'transfer',
      installments: 'transfer',
      reason: 'Cesión firmada ante notaría.',
    })
  })
})

describe('PropertyMediaGallery', () => {
  const medios = [
    { id: 'm1', kind: 'photo' as const, path: `${PROPIEDAD}/photo/uno.jpg`, position: 0, url: 'https://x/uno.jpg' },
    { id: 'm2', kind: 'photo' as const, path: `${PROPIEDAD}/photo/dos.jpg`, position: 1, url: 'https://x/dos.jpg' },
  ]

  it('RF-08.5 · muestra las fotos en el orden que fijó el administrador', async () => {
    const galeria = await mountSuspended(PropertyMediaGallery, {
      props: { medios, puedeGestionar: true, subiendo: false },
    })

    const imagenes = galeria.findAll('[data-test="galeria-photo"] img')
    expect(imagenes).toHaveLength(2)
  })

  it('RF-08.5 · sin archivos lo dice en vez de dejar un hueco', async () => {
    const galeria = await mountSuspended(PropertyMediaGallery, {
      props: { medios: [], puedeGestionar: true, subiendo: false },
    })

    expect(galeria.text()).toContain('Todavía no hay archivos.')
  })

  it('RF-08.5 · quitar un archivo se emite; el componente no borra nada', async () => {
    const galeria = await mountSuspended(PropertyMediaGallery, {
      props: { medios, puedeGestionar: true, subiendo: false },
    })

    await galeria.find('[data-test="quitar-m1"]').trigger('click')

    expect(galeria.emitted('quitar')).toEqual([['m1']])
  })

  it('RF-08.5 · quien solo mira no puede quitar ni subir', async () => {
    const galeria = await mountSuspended(PropertyMediaGallery, {
      props: { medios, puedeGestionar: false, subiendo: false },
    })

    expect(galeria.find('[data-test="quitar-m1"]').exists()).toBe(false)
    expect(galeria.find('input[type="file"]').exists()).toBe(false)
  })

  it('RF-08.5 · un archivo con formato ajeno se rechaza antes de subirlo', async () => {
    const galeria = await mountSuspended(PropertyMediaGallery, {
      props: { medios: [], puedeGestionar: true, subiendo: false },
    })

    const entrada = galeria.find('[data-test="subir-photo"] input[type="file"]')
    Object.defineProperty(entrada.element, 'files', {
      value: [new File(['contenido'], 'documento.txt', { type: 'text/plain' })],
    })
    await entrada.trigger('change')
    await flushPromises()

    expect(galeria.text()).toContain('Ese formato de archivo no se admite aquí.')
    expect(galeria.emitted('subir')).toBeUndefined()
  })
})
