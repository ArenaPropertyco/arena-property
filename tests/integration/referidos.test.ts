import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AmbassadorSignupForm from '~/components/AmbassadorSignupForm.vue'
import AmbassadorsTable from '~/components/AmbassadorsTable.vue'
import AmbassadorCommissionTable from '~/components/AmbassadorCommissionTable.vue'
import CommissionTypeForm from '~/components/CommissionTypeForm.vue'
import CommissionTypesList from '~/components/CommissionTypesList.vue'
import ReferralCodeCard from '~/components/ReferralCodeCard.vue'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import { referralLink } from '#shared/referrals/code'
import type { CommissionType, CommissionTypeDraft } from '#shared/referrals/commission'
import type { SignupDraft } from '#shared/referrals/signup'
import { TERMS_VERSION } from '#shared/referrals/signup'
import type { AmbassadorCommissionListed, AmbassadorListed } from '#shared/referrals/views'

/**
 * HU-49 · RF-49.1…RF-49.5 · HU-50 · RF-50.3, RF-50.4 · HU-52 · RF-52.1…RF-52.4 ·
 * RT-06 · principio 10 — los componentes del Programa de Referidos reciben datos
 * ya resueltos y emiten lo que el Superadmin o el aspirante deciden. Ninguno
 * calcula reglas: las trae `shared/referrals`.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const TIPOS: CommissionType[] = [
  { id: 't1', name: 'Base', kind: 'percentage', amount: null, basisPoints: 300, isDefault: true, active: true, createdBy: 'super-1', createdAt: '2026-09-01T10:00:00Z' },
  { id: 't2', name: 'Premium', kind: 'fixed', amount: pesos(5_000_000), basisPoints: null, isDefault: false, active: true, createdBy: 'super-1', createdAt: '2026-09-02T10:00:00Z' },
  { id: 't3', name: 'Antiguo', kind: 'percentage', amount: null, basisPoints: 200, isDefault: false, active: false, createdBy: 'super-1', createdAt: '2026-08-01T10:00:00Z' },
]

const EMBAJADORES_CON_COMISION: AmbassadorCommissionListed[] = [
  { ambassadorId: 'a1', email: 'ana@ejemplo.com', fullName: 'Ana', assignedTypeId: 't2', effectiveTypeName: 'Premium', assignedAt: '2026-09-05T10:00:00Z' },
  { ambassadorId: 'a2', email: 'luis@ejemplo.com', fullName: null, assignedTypeId: null, effectiveTypeName: 'Base', assignedAt: null },
]

describe('CommissionTypeForm', () => {
  const props = { types: TIPOS, enviando: false }

  it('RF-52.1 · un tipo porcentual viaja en puntos básicos, no en coma flotante', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    Object.assign(formulario.vm.estado, { name: 'Aliados', kind: 'percentage', porcentaje: 4.5 })
    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as CommissionTypeDraft)
      .toEqual({ name: 'Aliados', kind: 'percentage', amount: null, basisPoints: 450, makeDefault: false })
  })

  it('RF-52.1 · RF-52.3 · un tipo de importe fijo puede nacer como predeterminado', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    Object.assign(formulario.vm.estado, { name: 'Bono', kind: 'fixed', monto: 1_500_000, makeDefault: true })
    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as CommissionTypeDraft)
      .toEqual({ name: 'Bono', kind: 'fixed', amount: pesos(1_500_000), basisPoints: null, makeDefault: true })
  })

  it('RF-52.1 · un porcentaje escrito en el campo llega al motor; el campo numérico no entrega texto', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    formulario.vm.estado.name = 'Gold'
    await formulario.find('input[type="number"]').setValue('7.12')

    // El campo entrega un número: tratarlo como texto era lo que rompía el envío.
    expect(typeof formulario.vm.estado.porcentaje).toBe('number')

    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-comision-porcentaje"]').text()).not.toContain('100 %')
    expect(formulario.emitted('submit')?.[0]?.[0] as CommissionTypeDraft)
      .toEqual({ name: 'Gold', kind: 'percentage', amount: null, basisPoints: 712, makeDefault: false })
  })

  it('RF-52.1 · un importe fijo escrito en el campo se guarda en pesos enteros', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    Object.assign(formulario.vm.estado, { name: 'Gold fijo', kind: 'fixed' })
    await flushPromises()
    await formulario.find('input[type="number"]').setValue('3500000')

    expect(typeof formulario.vm.estado.monto).toBe('number')

    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as CommissionTypeDraft)
      .toEqual({ name: 'Gold fijo', kind: 'fixed', amount: pesos(3_500_000), basisPoints: null, makeDefault: false })
  })

  it('CA-52.3 · un nombre repetido se rechaza antes de enviarlo', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    Object.assign(formulario.vm.estado, { name: '  premium ', kind: 'percentage', porcentaje: 5 })
    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comision-nombre"]').text()).toContain('Ya existe')
  })

  it('CA-52.3 · un porcentaje por encima del 100 % se rechaza antes de enviarlo', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    Object.assign(formulario.vm.estado, { name: 'Excesivo', kind: 'percentage', porcentaje: 120 })
    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comision-porcentaje"]').text()).toContain('100')
  })

  it('CA-52.3 · un importe fijo de cero se rechaza antes de enviarlo', async () => {
    const formulario = await mountSuspended(CommissionTypeForm, { props })

    Object.assign(formulario.vm.estado, { name: 'Cero', kind: 'fixed', monto: 0 })
    await formulario.find('[data-test="formulario-tipo-comision"]').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comision-monto"]').text()).toContain('mayor que cero')
  })
})

describe('CommissionTypesList', () => {
  it('RF-52.1 · lista cada tipo con su valor ya formateado', async () => {
    const lista = await mountSuspended(CommissionTypesList, { props: { types: TIPOS, ocupadoId: null } })

    expect(lista.find('[data-test="valor-t2"]').text()).toBe(formatearImporte(pesos(5_000_000), 'es'))
    expect(lista.find('[data-test="valor-t1"]').text()).toContain('3')
  })

  it('RF-52.3 · marca el predeterminado y los retirados', async () => {
    const lista = await mountSuspended(CommissionTypesList, { props: { types: TIPOS, ocupadoId: null } })

    expect(lista.find('[data-test="predeterminado-t1"]').exists()).toBe(true)
    expect(lista.find('[data-test="inactivo-t3"]').exists()).toBe(true)
    expect(lista.find('[data-test="inactivo-t2"]').exists()).toBe(false)
  })

  it('CA-52.5 · el predeterminado no se ofrece a sí mismo ni se desactiva', async () => {
    const lista = await mountSuspended(CommissionTypesList, { props: { types: TIPOS, ocupadoId: null } })

    expect(lista.find('[data-test="marcar-t1"]').exists()).toBe(false)
    expect(lista.find('[data-test="activar-t1"]').exists()).toBe(false)
    expect(lista.find('[data-test="marcar-t2"]').exists()).toBe(true)
  })

  it('CA-52.5 · nombrar predeterminado emite el tipo elegido', async () => {
    const lista = await mountSuspended(CommissionTypesList, { props: { types: TIPOS, ocupadoId: null } })

    await lista.find('[data-test="marcar-t2"]').trigger('click')
    expect(lista.emitted('predeterminado')?.[0]).toEqual(['t2'])
  })

  it('RF-52.2 · retirar y volver a ofrecer emiten el estado contrario al actual', async () => {
    const lista = await mountSuspended(CommissionTypesList, { props: { types: TIPOS, ocupadoId: null } })

    await lista.find('[data-test="activar-t2"]').trigger('click')
    await lista.find('[data-test="activar-t3"]').trigger('click')
    expect(lista.emitted('activar')).toEqual([['t2', false], ['t3', true]])
  })

  it('RF-52.1 · sin tipos lo dice', async () => {
    const lista = await mountSuspended(CommissionTypesList, { props: { types: [], ocupadoId: null } })
    expect(lista.find('[data-test="sin-tipos"]').exists()).toBe(true)
  })
})

describe('AmbassadorCommissionTable', () => {
  const props = {
    ambassadors: EMBAJADORES_CON_COMISION,
    types: TIPOS.filter(t => t.active),
    ocupadoId: null,
  }

  it('CA-52.1 · cada Embajador muestra el tipo que realmente le aplica', async () => {
    const tabla = await mountSuspended(AmbassadorCommissionTable, { props })

    expect(tabla.find('[data-test="vigente-a1"]').text()).toContain('Premium')
    expect(tabla.find('[data-test="vigente-a2"]').text()).toContain('Base')
  })

  it('RF-52.4 · el desplegable ofrece los tipos activos y la vuelta al predeterminado', async () => {
    const tabla = await mountSuspended(AmbassadorCommissionTable, { props })
    const opciones = tabla.findComponent({ name: 'USelect' }).props('items') as { label: string }[]

    expect(opciones.map(o => o.label)).toEqual(['El predeterminado', 'Base', 'Premium'])
  })

  it('RF-52.4 · elegir un tipo emite la asignación', async () => {
    const tabla = await mountSuspended(AmbassadorCommissionTable, { props })

    tabla.findAllComponents({ name: 'USelect' })[1]!.vm.$emit('update:modelValue', 't2')
    await flushPromises()
    expect(tabla.emitted('asignar')?.[0]).toEqual(['a2', 't2'])
  })

  it('RF-52.4 · volver al predeterminado emite la retirada de la asignación', async () => {
    const tabla = await mountSuspended(AmbassadorCommissionTable, { props })

    tabla.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'predeterminado')
    await flushPromises()
    expect(tabla.emitted('asignar')?.[0]).toEqual(['a1', null])
  })

  it('RF-52.4 · sin Embajadores aprobados lo dice', async () => {
    const tabla = await mountSuspended(AmbassadorCommissionTable, { props: { ...props, ambassadors: [] } })
    expect(tabla.find('[data-test="sin-embajadores-comision"]').exists()).toBe(true)
  })
})

describe('AmbassadorSignupForm', () => {
  it('CA-49.1 · sin aceptar los términos no se envía y se explica', async () => {
    const formulario = await mountSuspended(AmbassadorSignupForm, { props: { termsVersion: TERMS_VERSION, enviando: false } })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-embajador-terminos"]').text()).toContain('términos')
  })

  it('CA-49.1 · RF-49.3 · unos datos de pago incompletos se explican campo por campo', async () => {
    const formulario = await mountSuspended(AmbassadorSignupForm, { props: { termsVersion: TERMS_VERSION, enviando: false } })
    const vm = formulario.vm as unknown as { estado: { termsAccepted: boolean, accountNumber: string } }

    vm.estado.termsAccepted = true
    vm.estado.accountNumber = 'ABC-123'
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-embajador-numero"]').text()).toContain('dígitos')
    expect(formulario.find('[data-test="campo-embajador-banco"]').text()).toContain('banco')
  })

  it('RF-49.2 · RF-49.3 · con todo completo emite la inscripción con la versión de términos', async () => {
    const formulario = await mountSuspended(AmbassadorSignupForm, { props: { termsVersion: TERMS_VERSION, enviando: false } })
    const vm = formulario.vm as unknown as {
      estado: { termsAccepted: boolean, bank: string, accountKind: string, accountNumber: string, holder: string }
    }

    Object.assign(vm.estado, {
      termsAccepted: true,
      bank: 'Bancolombia',
      accountKind: 'savings',
      accountNumber: '12345678901',
      holder: 'Ana Ruiz',
    })
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as SignupDraft).toEqual({
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      bank: { bank: 'Bancolombia', accountKind: 'savings', accountNumber: '12345678901', holder: 'Ana Ruiz' },
    })
  })
})

describe('AmbassadorsTable', () => {
  const embajadores: AmbassadorListed[] = [{
    id: 'a1',
    userId: 'u1',
    email: 'ana@correo.co',
    fullName: 'Ana Ruiz',
    status: 'pending',
    code: null,
    codeEnabled: false,
    bank: 'Bancolombia',
    accountKind: 'savings',
    accountNumber: '12345678901',
    holder: 'Ana Ruiz',
    termsVersion: TERMS_VERSION,
    enrolledAt: '2026-09-01T12:00:00Z',
    approvedAt: null,
  }, {
    id: 'a2',
    userId: 'u2',
    email: 'luis@correo.co',
    fullName: 'Luis Mora',
    status: 'approved',
    code: 'ARENA234',
    codeEnabled: true,
    bank: 'Davivienda',
    accountKind: 'checking',
    accountNumber: '99999999',
    holder: 'Luis Mora',
    termsVersion: TERMS_VERSION,
    enrolledAt: '2026-08-01T12:00:00Z',
    approvedAt: '2026-08-02T12:00:00Z',
  }]

  it('RF-49.5 · lista cada inscripción con su estado, datos de pago, código y fecha de alta', async () => {
    const tabla = await mountSuspended(AmbassadorsTable, { props: { embajadores, ocupadoId: null } })

    expect(tabla.find('[data-test="embajador-a1"]').text()).toContain('ana@correo.co')
    expect(tabla.find('[data-test="embajador-a1"]').text()).toContain('Bancolombia')
    expect(tabla.find('[data-test="embajador-a2"]').text()).toContain('ARENA234')
    expect(tabla.find('[data-test="estado-a1"]').text()).toContain('Pendiente')
    expect(tabla.find('[data-test="estado-a2"]').text()).toContain('Aprobado')
  })

  it('CA-49.2 · aprobar una inscripción pendiente la emite', async () => {
    const tabla = await mountSuspended(AmbassadorsTable, { props: { embajadores, ocupadoId: null } })

    await tabla.find('[data-test="aprobar-a1"]').trigger('click')
    expect(tabla.emitted('resolver')?.[0]).toEqual(['a1', true, null])
  })

  it('RF-49.4 · rechazar exige motivo', async () => {
    const tabla = await mountSuspended(AmbassadorsTable, { props: { embajadores, ocupadoId: null } })

    await tabla.find('[data-test="formulario-rechazo-a1"]').trigger('submit')
    await flushPromises()
    expect(tabla.emitted('resolver')).toBeUndefined()

    await tabla.find('[data-test="motivo-rechazo-a1"]').setValue('Datos bancarios de un tercero')
    await tabla.find('[data-test="formulario-rechazo-a1"]').trigger('submit')
    await flushPromises()
    expect(tabla.emitted('resolver')?.[0]).toEqual(['a1', false, 'Datos bancarios de un tercero'])
  })

  it('RF-49.5 · una inscripción ya resuelta no ofrece aprobar ni rechazar', async () => {
    const tabla = await mountSuspended(AmbassadorsTable, { props: { embajadores, ocupadoId: null } })
    expect(tabla.find('[data-test="aprobar-a2"]').exists()).toBe(false)
  })

  it('RF-49.5 · sin inscripciones lo dice', async () => {
    const tabla = await mountSuspended(AmbassadorsTable, { props: { embajadores: [], ocupadoId: null } })
    expect(tabla.find('[data-test="sin-embajadores"]').exists()).toBe(true)
  })
})

describe('ReferralCodeCard', () => {
  const BASE = 'https://arena-property.com'
  const CODIGO = 'ARENA234'

  it('CA-50.3 · muestra el código y el enlace compartible con el código correcto', async () => {
    const tarjeta = await mountSuspended(ReferralCodeCard, { props: { code: CODIGO, baseUrl: BASE } })

    expect(tarjeta.find('[data-test="codigo-referido"]').text()).toContain(CODIGO)
    expect(tarjeta.find('[data-test="enlace-referido"]').text()).toContain(referralLink(BASE, CODIGO))
  })

  it('CA-50.4 · los botones de difusión llevan el enlace codificado', async () => {
    const tarjeta = await mountSuspended(ReferralCodeCard, { props: { code: CODIGO, baseUrl: BASE } })
    const enlace = referralLink(BASE, CODIGO)

    const whatsapp = tarjeta.find('[data-test="compartir-whatsapp"]').attributes('href')
    const correo = tarjeta.find('[data-test="compartir-email"]').attributes('href')

    expect(whatsapp).toContain(encodeURIComponent(enlace))
    expect(whatsapp?.startsWith('https://wa.me/?text=')).toBe(true)
    expect(correo?.startsWith('mailto:?subject=')).toBe(true)
    expect(correo).toContain(encodeURIComponent(enlace))
    expect(tarjeta.find('[data-test="compartir-x"]').attributes('href')).toContain(encodeURIComponent(enlace))
    expect(tarjeta.find('[data-test="compartir-facebook"]').attributes('href')).toContain(encodeURIComponent(enlace))
  })

  it('CA-50.2 · RF-50.2 · el código se muestra, nunca se edita', async () => {
    const tarjeta = await mountSuspended(ReferralCodeCard, { props: { code: CODIGO, baseUrl: BASE } })
    expect(tarjeta.findAll('input').length).toBe(0)
  })
})
