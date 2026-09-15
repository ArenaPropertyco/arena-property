import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MovementShareDetail from '~/components/MovementShareDetail.vue'
import RentalCommissionForm from '~/components/RentalCommissionForm.vue'
import RentalIncomeForm from '~/components/RentalIncomeForm.vue'
import ThirdPartyBookingForm from '~/components/ThirdPartyBookingForm.vue'
import ThirdPartyBookingsTable from '~/components/ThirdPartyBookingsTable.vue'
import ReleaseWeekNotice from '~/components/ReleaseWeekNotice.vue'
import { detalleDeCuota } from '#shared/finance/detalle'
import type { CuotaConMovimiento } from '#shared/finance/detalle'
import type { ReservaListada, SemanaDeBolsa } from '#shared/scheduling/vistas-renta'
import { pesos } from '#shared/money/importe'
import { puntosBasicos } from '#shared/money/comision'

/**
 * HU-39 · RF-39.1, RF-39.2, RF-39.4 · HU-40 · RF-40.1, RF-40.4, RF-40.6 ·
 * HU-24 · RF-24.2b, RF-24.2c · HU-14 · RF-14.7b · RT-06 · principio 10 · los
 * componentes de renta a terceros reciben datos ya resueltos y emiten lo que el
 * Administrador decide. Ninguno consulta Supabase ni calcula un reparto.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

function semana(cambios: Partial<SemanaDeBolsa> = {}): SemanaDeBolsa {
  return {
    week: 17,
    startsOn: '2031-05-03',
    endsOn: '2031-05-10',
    originReason: 'voluntary',
    originFraction: 3,
    ...cambios,
  }
}

function reserva(cambios: Partial<ReservaListada> = {}): ReservaListada {
  return {
    id: 'res-1',
    week: 17,
    startsOn: '2031-05-03',
    guestName: 'Marta Restrepo',
    originReason: 'voluntary',
    originFraction: 3,
    status: 'confirmed',
    cancelReason: null,
    incomeId: null,
    incomeAmount: null,
    commissionAmount: null,
    commissionBasisPoints: null,
    ...cambios,
  }
}

function cuota(cambios: Partial<CuotaConMovimiento> = {}): CuotaConMovimiento {
  return {
    movementId: 'mov-1',
    kind: 'expense',
    allocation: 'prorated',
    amount: pesos(100_000),
    categoryName: 'Mantenimiento',
    incurredOn: '2026-09-14',
    propertyName: 'Casa Invictvs',
    description: 'Bomba de la piscina',
    fraction: 1,
    shareAmount: pesos(12_500),
    hasRemainder: false,
    commissionBasisPoints: null,
    commissionAmount: null,
    weekStartsOn: null,
    weekIndex: null,
    ...cambios,
  }
}

describe('ThirdPartyBookingForm', () => {
  async function montar(props: Partial<InstanceType<typeof ThirdPartyBookingForm>['$props']> = {}) {
    return mountSuspended(ThirdPartyBookingForm, {
      props: { semanas: [semana(), semana({ week: 30, originReason: 'pool', originFraction: null })], huespedes: [], enviando: false, ...props },
    })
  }

  it('RF-39.2 · ofrece solo las semanas de la bolsa de renta, con su origen', async () => {
    const formulario = await montar()
    const opciones = formulario.findAllComponents({ name: 'USelect' })[0]!.props('items') as { value: number, label: string }[]

    expect(opciones.map(opcion => opcion.value)).toEqual([17, 30])
    expect(opciones[0]!.label).toContain('17')
  })

  it('RF-39.1 · RF-39.5 · emite la reserva con el huésped nuevo y su consentimiento', async () => {
    const formulario = await montar()

    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 17)
    await flushPromises()
    await formulario.find('[data-test="huesped-nombre"] input').setValue('Marta Restrepo')
    await formulario.find('[data-test="huesped-documento"] input').setValue('1.020.304-5')
    await formulario.find('[data-test="huesped-correo"] input').setValue('marta@ejemplo.com')
    formulario.findComponent({ name: 'UCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await formulario.find('form').trigger('submit')
    await flushPromises()

    const emitido = formulario.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(emitido).toMatchObject({
      week: 17,
      guest: { fullName: 'Marta Restrepo', documentKind: 'cc', documentNumber: '1.020.304-5', email: 'marta@ejemplo.com', consentAccepted: true },
    })
  })

  it('RF-39.5 · D-25 · sin consentimiento no se emite y lo dice', async () => {
    const formulario = await montar()

    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 17)
    await flushPromises()
    await formulario.find('[data-test="huesped-nombre"] input').setValue('Marta Restrepo')
    await formulario.find('[data-test="huesped-documento"] input').setValue('1020304')
    await formulario.find('[data-test="huesped-correo"] input').setValue('marta@ejemplo.com')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-consentimiento"]').text()).toContain('autorización')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('RF-39.2 · sin semanas en la bolsa lo dice en vez de ofrecer un desplegable vacío', async () => {
    const formulario = await montar({ semanas: [] })

    expect(formulario.find('[data-test="sin-semanas"]').text()).toContain('No hay semanas')
  })
})

describe('ThirdPartyBookingsTable', () => {
  it('RF-39.2b · D-39 · cada reserva dice de dónde salió la semana y a quién irá el ingreso', async () => {
    const tabla = await mountSuspended(ThirdPartyBookingsTable, {
      props: {
        reservas: [reserva(), reserva({ id: 'res-2', week: 30, originReason: 'pool', originFraction: null })],
        puedeGestionar: true,
      },
    })

    expect(tabla.find('[data-test="origen-res-1"]').text()).toContain('3/8')
    expect(tabla.find('[data-test="destino-res-1"]').text()).toContain('fracción 3/8')
    expect(tabla.find('[data-test="destino-res-2"]').text()).toContain('entre las 8')
  })

  it('RF-40.1 · ofrece registrar el ingreso mientras la reserva no lo tenga', async () => {
    const tabla = await mountSuspended(ThirdPartyBookingsTable, {
      props: { reservas: [reserva()], puedeGestionar: true },
    })

    await tabla.find('[data-test="registrar-ingreso-res-1"]').trigger('click')
    expect(tabla.emitted('ingreso')).toEqual([['res-1']])
  })

  it('CA-40.4 · con el ingreso registrado muestra el bruto y la comisión, y ya no lo ofrece', async () => {
    const tabla = await mountSuspended(ThirdPartyBookingsTable, {
      props: {
        reservas: [reserva({ incomeId: 'mov-9', incomeAmount: pesos(800_000), commissionAmount: pesos(160_000), commissionBasisPoints: puntosBasicos(20) })],
        puedeGestionar: true,
      },
    })

    expect(tabla.find('[data-test="ingreso-res-1"]').text()).toContain('800.000')
    expect(tabla.find('[data-test="registrar-ingreso-res-1"]').exists()).toBe(false)
  })

  it('CA-39.4 · una reserva cancelada sigue en la lista, marcada y sin acciones', async () => {
    const tabla = await mountSuspended(ThirdPartyBookingsTable, {
      props: { reservas: [reserva({ status: 'cancelled', cancelReason: 'El tercero desistió.' })], puedeGestionar: true },
    })

    expect(tabla.find('[data-test="cancelada-res-1"]').text()).toBe('Cancelada')
    expect(tabla.find('[data-test="cancelar-res-1"]').exists()).toBe(false)
  })
})

describe('RentalIncomeForm', () => {
  it('CA-40.4 · sobre una semana liberada anticipa comisión y neto antes de guardar', async () => {
    const formulario = await mountSuspended(RentalIncomeForm, {
      props: { reserva: reserva(), comisionPuntosBasicos: puntosBasicos(20), enviando: false },
    })

    await formulario.find('[data-test="campo-ingreso"] input').setValue('800000')
    await flushPromises()

    const texto = formulario.find('[data-test="previsualizacion"]').text()
    expect(texto).toContain('160.000')
    expect(texto).toContain('640.000')
  })

  it('RF-40.2 · sobre una semana cancelada avisa que se reparte entre las ocho, sin comisión', async () => {
    const formulario = await mountSuspended(RentalIncomeForm, {
      props: { reserva: reserva({ originReason: 'cancelled' }), comisionPuntosBasicos: puntosBasicos(20), enviando: false },
    })

    await formulario.find('[data-test="campo-ingreso"] input').setValue('800000')
    await flushPromises()

    expect(formulario.find('[data-test="previsualizacion"]').text()).toContain('entre las 8')
  })

  it('CA-40.5 · sin comisión configurada no deja registrar el ingreso de una semana liberada', async () => {
    const formulario = await mountSuspended(RentalIncomeForm, {
      props: { reserva: reserva(), comisionPuntosBasicos: null, enviando: false },
    })

    expect(formulario.find('[data-test="sin-comision"]').text()).toContain('comisión de gestión')
    expect(formulario.find('[data-test="enviar-ingreso"]').exists()).toBe(false)
  })

  it('RF-40.1 · un valor de cero no se emite', async () => {
    const formulario = await mountSuspended(RentalIncomeForm, {
      props: { reserva: reserva(), comisionPuntosBasicos: puntosBasicos(20), enviando: false },
    })

    await formulario.find('[data-test="campo-ingreso"] input').setValue('0')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-ingreso"]').text()).toContain('mayor que cero')
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('RentalCommissionForm', () => {
  it('RF-40.4 · emite el porcentaje en puntos básicos enteros', async () => {
    const formulario = await mountSuspended(RentalCommissionForm, {
      props: { puntosBasicos: null, enviando: false },
    })

    await formulario.find('[data-test="campo-comision"] input').setValue('17.5')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[1750]])
  })

  it('RF-40.4 · un porcentaje fuera de rango no se emite', async () => {
    const formulario = await mountSuspended(RentalCommissionForm, {
      props: { puntosBasicos: null, enviando: false },
    })

    await formulario.find('[data-test="campo-comision"] input').setValue('120')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comision"]').text()).toContain('0 a 100')
  })

  it('RF-40.5 · sin configurar lo dice, para que no parezca un cero', async () => {
    const formulario = await mountSuspended(RentalCommissionForm, { props: { puntosBasicos: null, enviando: false } })

    expect(formulario.find('[data-test="comision-actual"]').text()).toContain('Sin configurar')
  })
})

describe('MovementShareDetail', () => {
  it('CA-24.1 · una cuota prorrateada muestra el movimiento, la fórmula y el monto final', async () => {
    const vista = await mountSuspended(MovementShareDetail, { props: { detalle: detalleDeCuota(cuota()) } })

    expect(vista.find('[data-test="formula"]').text()).toContain('÷ 8')
    expect(vista.find('[data-test="monto-original"]').text()).toContain('100.000')
    expect(vista.find('[data-test="cuota"]').text()).toContain('12.500')
  })

  it('CA-24.2 · el residuo aparece explícito', async () => {
    const vista = await mountSuspended(MovementShareDetail, {
      props: { detalle: detalleDeCuota(cuota({ amount: pesos(100_001), shareAmount: pesos(12_501), hasRemainder: true })) },
    })

    expect(vista.find('[data-test="residuo"]').text()).toContain('1')
  })

  it('CA-24.2c · D-41 · una cuota imputada no muestra la fórmula de división', async () => {
    const vista = await mountSuspended(MovementShareDetail, {
      props: {
        detalle: detalleDeCuota(cuota({ allocation: 'single_fraction', amount: pesos(150_000), shareAmount: pesos(150_000), fraction: 3 })),
      },
    })

    expect(vista.find('[data-test="formula"]').exists()).toBe(false)
    expect(vista.find('[data-test="imputado"]').text()).toContain('3/8')
    expect(vista.find('[data-test="cuota"]').text()).toContain('150.000')
  })

  it('CA-24.2b · D-39 · un ingreso atribuido muestra bruto, comisión y neto, y nombra la semana', async () => {
    const vista = await mountSuspended(MovementShareDetail, {
      props: {
        detalle: detalleDeCuota(cuota({
          kind: 'income',
          allocation: 'single_fraction',
          amount: pesos(800_000),
          categoryName: 'Renta a terceros',
          fraction: 3,
          shareAmount: pesos(640_000),
          commissionBasisPoints: puntosBasicos(20),
          commissionAmount: pesos(160_000),
          weekStartsOn: '2031-05-03',
          weekIndex: 17,
        })),
      },
    })

    expect(vista.find('[data-test="bruto"]').text()).toContain('800.000')
    expect(vista.find('[data-test="comision"]').text()).toContain('160.000')
    expect(vista.find('[data-test="neto"]').text()).toContain('640.000')
    expect(vista.find('[data-test="semana"]').text()).toContain('17')
    expect(vista.find('[data-test="formula"]').exists()).toBe(false)
  })
})

describe('ReleaseWeekNotice', () => {
  it('CA-14.8b · RF-14.7b · D-39 · avisa de la consecuencia económica antes de liberar', async () => {
    const aviso = await mountSuspended(ReleaseWeekNotice, { props: { week: 17, enviando: false } })

    const texto = aviso.text()
    expect(texto).toContain('el ingreso es de tu fracción')
    expect(texto).toContain('caducar')
  })

  it('RF-14.7b · solo emite la liberación cuando se confirma', async () => {
    const aviso = await mountSuspended(ReleaseWeekNotice, { props: { week: 17, enviando: false } })

    expect(aviso.emitted('confirmar')).toBeUndefined()
    await aviso.find('[data-test="confirmar-liberacion"]').trigger('click')
    expect(aviso.emitted('confirmar')).toEqual([[17]])
  })
})
