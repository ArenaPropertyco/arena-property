import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FractionsTable from '~/components/FractionsTable.vue'
import PaymentForm from '~/components/PaymentForm.vue'
import PaymentPlanSummary from '~/components/PaymentPlanSummary.vue'
import PaymentsTable from '~/components/PaymentsTable.vue'
import PurchaseInviteForm from '~/components/PurchaseInviteForm.vue'
import PurchaseInvitationsTable from '~/components/PurchaseInvitationsTable.vue'
import ReasonForm from '~/components/ReasonForm.vue'
import { pesos } from '#shared/money/importe'
import type { AbonoListado, PlanDePagosListado } from '#shared/payments/vistas'
import type { FraccionListada } from '#shared/properties/vistas'
import type { InvitacionListada } from '#shared/purchases/vistas'

/**
 * HU-06 y HU-58 · principio 10 · los componentes de venta y plan de pagos reciben
 * datos por props y comunican por eventos. Ninguno consulta Supabase ni suma un
 * peso: el estado, el saldo y el calendario llegan derivados por la base.
 */

const PROPIEDAD = 'a5000000-0000-4000-8000-000000000001'

function fraccion(cambios: Partial<FraccionListada> & { number: number }): FraccionListada {
  return {
    id: `f-${cambios.number}`,
    propertyId: PROPIEDAD,
    listPrice: pesos(180_000_000),
    status: 'available',
    ownerId: null,
    ownerLabel: null,
    calendarActive: false,
    planId: null,
    ...cambios,
  }
}

function invitacion(cambios: Partial<InvitacionListada> = {}): InvitacionListada {
  return {
    id: 'inv-1',
    fractionId: 'f-1',
    fractionNumber: 1,
    propertyId: PROPIEDAD,
    email: 'comprador@ejemplo.com',
    inviteeId: 'u-1',
    status: 'pending',
    agreedPrice: pesos(180_000_000),
    referralCode: null,
    createdAt: '2026-09-03T12:00:00Z',
    ...cambios,
  }
}

function plan(cambios: Partial<PlanDePagosListado> = {}): PlanDePagosListado {
  return {
    id: 'plan-1',
    fractionId: 'f-1',
    fractionNumber: 1,
    propertyId: PROPIEDAD,
    propertyName: 'Casa Arena',
    ownerId: 'u-1',
    ownerLabel: 'comprador@ejemplo.com',
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

function abono(cambios: Partial<AbonoListado> = {}): AbonoListado {
  return {
    id: 'ab-1',
    amount: pesos(30_000_000),
    paidOn: '2026-09-01',
    method: 'transfer',
    note: null,
    receiptPath: 'p/plan/uno.pdf',
    receiptUrl: 'https://firmada/uno.pdf',
    voidedAt: null,
    voidReason: null,
    ...cambios,
  }
}

describe('FractionsTable · venta', () => {
  it('RF-06.1 · ofrece invitar sobre disponible y reservada, y emite la fracción', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [fraccion({ number: 1 }), fraccion({ number: 2, status: 'reserved' })],
        puedeGestionar: true,
        esSuperadmin: false,
      },
    })

    await tabla.find('[data-test="fraccion-2-invitar"]').trigger('click')

    expect(tabla.find('[data-test="fraccion-1-invitar"]').exists()).toBe(true)
    expect(tabla.emitted('invitar')).toEqual([['f-2']])
  })

  it('CA-06.4 · sobre una vendida no ofrece invitar, y abre su plan de pagos', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: {
        fracciones: [fraccion({ number: 3, status: 'sold', ownerId: 'u-1', planId: 'plan-1' })],
        puedeGestionar: true,
        esSuperadmin: false,
      },
    })

    expect(tabla.find('[data-test="fraccion-3-invitar"]').exists()).toBe(false)
    await tabla.find('[data-test="fraccion-3-plan"]').trigger('click')
    expect(tabla.emitted('abrirPlan')).toEqual([['plan-1']])
  })

  it('sin permiso de gestión no ofrece invitar', async () => {
    const tabla = await mountSuspended(FractionsTable, {
      props: { fracciones: [fraccion({ number: 1 })], puedeGestionar: false, esSuperadmin: false },
    })

    expect(tabla.find('[data-test="fraccion-1-invitar"]').exists()).toBe(false)
  })
})

describe('PurchaseInviteForm', () => {
  it('RF-06.1 · propone el precio de lista como precio pactado y emite la solicitud', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: { fraccion: fraccion({ number: 1 }), enviando: false },
    })

    expect((formulario.find('[data-test="campo-precio-pactado"] input').element as HTMLInputElement).value)
      .toBe('180000000')

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('Comprador@Ejemplo.com')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[{
      fractionId: 'f-1',
      propertyId: PROPIEDAD,
      fractionStatus: 'available',
      email: 'Comprador@Ejemplo.com',
      agreedPrice: 180_000_000,
      referralCode: null,
    }, { cerrarAhora: true }]])
  })

  it('RF-06.1 · sugiere cuentas existentes por nombre o correo y rellena el correo al elegir', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: {
        fraccion: fraccion({ number: 1 }),
        enviando: false,
        cuentas: [
          { id: 'u-1', email: 'juan@ejemplo.com', fullName: 'Juan Pérez' },
          { id: 'u-2', email: 'ana@ejemplo.com', fullName: 'Ana Gómez' },
        ],
      },
    })

    expect(formulario.find('[data-test="sugerencia-u-1"]').exists()).toBe(false)

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('per')
    expect(formulario.find('[data-test="sugerencia-u-1"]').exists()).toBe(true)
    expect(formulario.find('[data-test="sugerencia-u-2"]').exists()).toBe(false)

    await formulario.find('[data-test="sugerencia-u-1"]').trigger('click')
    expect((formulario.find('[data-test="campo-correo-comprador"] input').element as HTMLInputElement).value)
      .toBe('juan@ejemplo.com')
    expect(formulario.find('[data-test="cuenta-conocida"]').text()).toContain('Juan Pérez')
    expect(formulario.find('[data-test="sugerencia-u-1"]').exists()).toBe(false)
  })

  it('CA-06.2 · por defecto registra la venta al vincular; desmarcado, solo deja la invitación', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: { fraccion: fraccion({ number: 1 }), enviando: false },
    })

    expect(formulario.find('[data-test="cerrar-ahora"]').attributes('aria-checked')).toBe('true')
    expect(formulario.find('[data-test="enviar-invitacion"]').text()).toBe('Vincular como propietario')

    await formulario.find('[data-test="cerrar-ahora"]').trigger('click')
    expect(formulario.find('[data-test="enviar-invitacion"]').text()).toBe('Enviar invitación')

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('nuevo@ejemplo.com')
    expect(formulario.find('[data-test="cuenta-nueva"]').exists()).toBe(true)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[1]).toEqual({ cerrarAhora: false })
  })

  it('RF-06.4 · el código del embajador viaja normalizado en la solicitud', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: { fraccion: fraccion({ number: 1 }), enviando: false },
    })

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('comprador@ejemplo.com')
    await formulario.find('[data-test="campo-codigo-referido"] input').setValue(' luis-2026 ')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ referralCode: 'LUIS-2026' })
  })

  it('RF-06.4 · un código con formato inválido muestra el error y no emite', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: { fraccion: fraccion({ number: 1 }), enviando: false },
    })

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('comprador@ejemplo.com')
    await formulario.find('[data-test="campo-codigo-referido"] input').setValue('x')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-codigo-referido"]').text()).toContain('formato válido')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('con correo inválido muestra el error traducido y no emite', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: { fraccion: fraccion({ number: 1 }), enviando: false },
    })

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('sin-arroba')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-correo-comprador"]').text()).toContain('Escribe un correo válido.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-06.4 · sobre una fracción vendida no emite: la muestra como no invitable', async () => {
    const formulario = await mountSuspended(PurchaseInviteForm, {
      props: { fraccion: fraccion({ number: 1, status: 'sold', ownerId: 'u-9' }), enviando: false },
    })

    await formulario.find('[data-test="campo-correo-comprador"] input').setValue('otro@ejemplo.com')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="error-fraccion"]').text()).toContain('ya no admite invitaciones')
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('PurchaseInvitationsTable', () => {
  it('RF-06.2 · ofrece registrar la venta solo si el invitado ya tiene cuenta', async () => {
    const tabla = await mountSuspended(PurchaseInvitationsTable, {
      props: {
        invitaciones: [invitacion(), invitacion({ id: 'inv-2', fractionNumber: 2, inviteeId: null, email: 'nuevo@ejemplo.com' })],
        puedeGestionar: true,
        ocupado: false,
      },
    })

    expect(tabla.find('[data-test="cerrar-compra-inv-1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="cerrar-compra-inv-2"]').exists()).toBe(false)
    expect(tabla.find('[data-test="sin-cuenta-inv-2"]').text()).toBe('Sin cuenta todavía')

    await tabla.find('[data-test="cerrar-compra-inv-1"]').trigger('click')
    expect(tabla.emitted('cerrar')).toEqual([['inv-1']])
  })

  it('una invitación aceptada o cancelada ya no ofrece acciones', async () => {
    const tabla = await mountSuspended(PurchaseInvitationsTable, {
      props: {
        invitaciones: [invitacion({ status: 'accepted' }), invitacion({ id: 'inv-3', status: 'cancelled' })],
        puedeGestionar: true,
        ocupado: false,
      },
    })

    expect(tabla.find('[data-test="estado-invitacion-inv-1"]').text()).toBe('Aceptada')
    expect(tabla.find('[data-test="cerrar-compra-inv-1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="cancelar-invitacion-inv-3"]').exists()).toBe(false)
  })

  it('RF-06.4 · muestra el código del embajador junto al invitado, solo cuando lo hay', async () => {
    const tabla = await mountSuspended(PurchaseInvitationsTable, {
      props: {
        invitaciones: [invitacion({ referralCode: 'LUIS-2026' }), invitacion({ id: 'inv-2', fractionNumber: 2 })],
        puedeGestionar: true,
        ocupado: false,
      },
    })

    expect(tabla.find('[data-test="referido-inv-1"]').text()).toBe('Referido por LUIS-2026')
    expect(tabla.find('[data-test="referido-inv-2"]').exists()).toBe(false)
  })

  it('cancelar emite la invitación sin ejecutar nada', async () => {
    const tabla = await mountSuspended(PurchaseInvitationsTable, {
      props: { invitaciones: [invitacion()], puedeGestionar: true, ocupado: false },
    })

    await tabla.find('[data-test="cancelar-invitacion-inv-1"]').trigger('click')
    expect(tabla.emitted('cancelar')).toEqual([['inv-1']])
  })
})

describe('PaymentPlanSummary', () => {
  it('CA-58.1 · muestra el estado derivado y las cifras tal como llegan', async () => {
    const resumen = await mountSuspended(PaymentPlanSummary, { props: { plan: plan() } })

    expect(resumen.find('[data-test="estado-plan"]').text()).toBe('En proceso de pago')
    expect(resumen.find('[data-test="abonado"]').text()).toContain('30.000.000')
    expect(resumen.find('[data-test="saldo"]').text()).toContain('70.000.000')
  })

  it('RF-58.9 · dice qué falta para activar el calendario mientras el pago no esté completo', async () => {
    const resumen = await mountSuspended(PaymentPlanSummary, { props: { plan: plan() } })

    expect(resumen.find('[data-test="calendario-plan"]').text()).toContain('Inactivo')
    expect(resumen.find('[data-test="aviso-calendario"]').text()).toContain('70.000.000')
  })

  it('CA-58.8 · con el pago completo el calendario aparece activo', async () => {
    const resumen = await mountSuspended(PaymentPlanSummary, {
      props: { plan: plan({ status: 'completed', paidTotal: pesos(100_000_000), balance: pesos(0), calendarActive: true }) },
    })

    expect(resumen.find('[data-test="estado-plan"]').text()).toBe('Pago completado')
    expect(resumen.find('[data-test="calendario-plan"]').text()).toContain('Activo')
    expect(resumen.find('[data-test="aviso-calendario"]').text()).toContain('derecho de uso está activo')
  })

  it('RF-58.8 · una compra anulada lo dice con su motivo', async () => {
    const resumen = await mountSuspended(PaymentPlanSummary, {
      props: { plan: plan({ status: 'voided', voidedAt: '2026-09-03T15:00:00Z', voidReason: 'Desistimiento firmado.' }) },
    })

    expect(resumen.find('[data-test="compra-anulada"]').text()).toContain('Desistimiento firmado.')
    expect(resumen.find('[data-test="aviso-calendario"]').exists()).toBe(false)
  })
})

describe('PaymentForm', () => {
  function archivo(nombre = 'recibo.pdf', tipo = 'application/pdf', tamano = 1024): File {
    return new File([new Uint8Array(tamano)], nombre, { type: tipo })
  }

  async function adjuntar(formulario: Awaited<ReturnType<typeof mountSuspended>>, file: File) {
    const entrada = formulario.find('[data-test="archivo-comprobante"]')
    Object.defineProperty(entrada.element, 'files', { value: [file], configurable: true })
    await entrada.trigger('change')
  }

  it('RF-58.2 · emite el abono con su comprobante', async () => {
    const formulario = await mountSuspended(PaymentForm, { props: { plan: plan(), enviando: false } })

    await formulario.find('[data-test="campo-monto"] input').setValue('20000000')
    await formulario.find('[data-test="campo-fecha"] input').setValue('2026-09-03')
    await adjuntar(formulario, archivo())
    await formulario.find('form').trigger('submit')
    await flushPromises()

    const emitido = formulario.emitted('submit')?.[0]?.[0] as { abono: unknown, archivo: File }
    expect(emitido.abono).toEqual({ amount: 20_000_000, paidOn: '2026-09-03', method: 'transfer', note: null })
    expect(emitido.archivo.name).toBe('recibo.pdf')
  })

  it('CA-58.2 · un abono que superaría el precio pactado no se emite', async () => {
    const formulario = await mountSuspended(PaymentForm, { props: { plan: plan(), enviando: false } })

    await formulario.find('[data-test="campo-monto"] input').setValue('70000001')
    await adjuntar(formulario, archivo())
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-monto"]').text()).toContain('superaría el precio pactado')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-58.6 · sin comprobante no se emite', async () => {
    const formulario = await mountSuspended(PaymentForm, { props: { plan: plan(), enviando: false } })

    await formulario.find('[data-test="campo-monto"] input').setValue('20000000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-comprobante"]').text()).toContain('Adjunta el comprobante.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-58.6 · un comprobante con formato ajeno se rechaza antes de subirlo', async () => {
    const formulario = await mountSuspended(PaymentForm, { props: { plan: plan(), enviando: false } })

    await formulario.find('[data-test="campo-monto"] input').setValue('20000000')
    await adjuntar(formulario, archivo('video.mp4', 'video/mp4'))
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-comprobante"]').text()).toContain('imagen o PDF')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('RF-58.8 · sobre un plan completado avisa que ya no admite abonos', async () => {
    const formulario = await mountSuspended(PaymentForm, {
      props: { plan: plan({ status: 'completed', paidTotal: pesos(100_000_000), balance: pesos(0) }), enviando: false },
    })

    await formulario.find('[data-test="campo-monto"] input').setValue('1')
    await adjuntar(formulario, archivo())
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="error-plan"]').text()).toContain('ya no admite abonos')
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('PaymentsTable', () => {
  it('RF-58.2 · lista el abono con su comprobante firmado y ofrece anularlo', async () => {
    const tabla = await mountSuspended(PaymentsTable, {
      props: { abonos: [abono()], puedeGestionar: true, abierto: true },
    })

    expect(tabla.find('[data-test="monto-abono-ab-1"]').text()).toContain('30.000.000')
    expect(tabla.find('[data-test="comprobante-ab-1"]').attributes('href')).toBe('https://firmada/uno.pdf')

    await tabla.find('[data-test="anular-abono-ab-1"]').trigger('click')
    expect(tabla.emitted('anular')).toEqual([['ab-1']])
  })

  it('CA-58.3 · un abono anulado sigue en la lista, marcado y sin acciones', async () => {
    const tabla = await mountSuspended(PaymentsTable, {
      props: {
        abonos: [abono({ voidedAt: '2026-09-03T10:00:00Z', voidReason: 'Devuelta por el banco.' })],
        puedeGestionar: true,
        abierto: true,
      },
    })

    expect(tabla.find('[data-test="anulado-ab-1"]').text()).toBe('Anulado')
    expect(tabla.find('[data-test="anular-abono-ab-1"]').exists()).toBe(false)
  })

  it('RF-58.8 · con la compra anulada no se anula nada más', async () => {
    const tabla = await mountSuspended(PaymentsTable, {
      props: { abonos: [abono()], puedeGestionar: true, abierto: false },
    })

    expect(tabla.find('[data-test="anular-abono-ab-1"]').exists()).toBe(false)
  })
})

describe('ReasonForm', () => {
  it('RF-58.5 · sin motivo no emite y muestra el error', async () => {
    const formulario = await mountSuspended(ReasonForm, {
      props: { descripcion: 'Anular.', etiqueta: 'Anular', enviando: false },
    })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-motivo"]').text()).toContain('Escribe el motivo.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('con motivo emite el texto recortado', async () => {
    const formulario = await mountSuspended(ReasonForm, {
      props: { descripcion: 'Anular.', etiqueta: 'Anular', enviando: false },
    })

    await formulario.find('[data-test="campo-motivo"] textarea').setValue('  Transferencia devuelta.  ')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([['Transferencia devuelta.']])
  })
})
