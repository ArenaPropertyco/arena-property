import { describe, expect, it } from 'vitest'
import {
  ACCION_DE_TRASPASO,
  DESTINOS_DE_CUOTAS,
  DESTINOS_DE_RESERVAS,
  planDeTraspaso,
  validarTraspaso,
} from '#shared/properties/traspaso'
import type { SolicitudDeTraspaso } from '#shared/properties/traspaso'

/**
 * HU-09 · RF-09.5 y D-17 — traspaso de titular de una fracción vendida.
 *
 * No hay mercado secundario en el MVP: el traspaso es una operación manual del
 * Superadmin (reventa, herencia, cesión) que **obliga a resolver explícitamente**
 * qué pasa con las semanas ya confirmadas y con las cuotas pendientes. Por eso los
 * dos destinos son campos obligatorios y no tienen valor por omisión: un traspaso
 * que no los decide deja derechos de uso y deuda en el aire.
 */

const ANTERIOR = 'a0000000-0000-4000-8000-000000000001'
const NUEVO = 'a0000000-0000-4000-8000-000000000002'

function solicitud(cambios: Partial<SolicitudDeTraspaso> = {}): SolicitudDeTraspaso {
  return {
    fractionId: 'f0000000-0000-4000-8000-000000000003',
    propertyId: 'c0000000-0000-4000-8000-00000000000a',
    fractionStatus: 'sold',
    previousOwnerId: ANTERIOR,
    newOwnerId: NUEVO,
    bookings: 'transfer',
    installments: 'transfer',
    reason: 'Cesión firmada ante notaría el 12 de agosto.',
    ...cambios,
  }
}

function camposConError(cambios: Partial<SolicitudDeTraspaso>, esSuperadmin = true): string[] {
  return validarTraspaso(solicitud(cambios), { esSuperadmin }).map(error => error.name)
}

describe('CA-09.5 · validación del traspaso', () => {
  it('una solicitud completa del Superadmin no produce errores', () => {
    expect(validarTraspaso(solicitud(), { esSuperadmin: true })).toEqual([])
  })

  it('CA-09.5 · quien no es Superadmin no traspasa nada (D-17)', () => {
    expect(camposConError({}, false)).toEqual(['actor'])
  })

  it('CA-09.5 · solo se traspasa una fracción vendida', () => {
    expect(camposConError({ fractionStatus: 'available' })).toEqual(['fractionStatus'])
    expect(camposConError({ fractionStatus: 'reserved' })).toEqual(['fractionStatus'])
  })

  it('CA-09.5 · el nuevo titular no puede ser el que ya la tiene', () => {
    expect(camposConError({ newOwnerId: ANTERIOR })).toEqual(['newOwnerId'])
  })

  it('CA-09.5 · el nuevo titular es obligatorio', () => {
    expect(camposConError({ newOwnerId: '  ' })).toEqual(['newOwnerId'])
  })

  it('RF-09.5 · el destino de las reservas debe decidirse explícitamente', () => {
    expect(camposConError({ bookings: null })).toEqual(['bookings'])
    expect(camposConError({ bookings: 'lo_que_sea' as never })).toEqual(['bookings'])
  })

  it('RF-09.5 · el destino de las cuotas pendientes también', () => {
    expect(camposConError({ installments: null })).toEqual(['installments'])
  })

  it('RF-A.4 · el traspaso no se registra sin motivo', () => {
    expect(camposConError({ reason: '   ' })).toEqual(['reason'])
  })

  it('CA-09.5 · varios problemas se reportan juntos', () => {
    expect(camposConError({ fractionStatus: 'available', reason: '', bookings: null }).sort())
      .toEqual(['bookings', 'fractionStatus', 'reason'])
  })

  it('RF-09.5 · el vocabulario de destinos es cerrado', () => {
    expect(DESTINOS_DE_RESERVAS).toEqual(['transfer', 'cancel'])
    expect(DESTINOS_DE_CUOTAS).toEqual(['transfer', 'settle_with_previous'])
  })
})

describe('CA-09.5 · efectos y registro del traspaso', () => {
  it('CA-09.5 · el nuevo titular queda vinculado y el anterior pierde el acceso', () => {
    const plan = planDeTraspaso(solicitud())

    expect(plan.efectos.newOwnerId).toBe(NUEVO)
    expect(plan.efectos.revokedFrom).toBe(ANTERIOR)
  })

  it('CA-09.5 · el registro de auditoría lleva el destino de reservas y de cuotas', () => {
    const { auditoria } = planDeTraspaso(solicitud({ bookings: 'cancel', installments: 'settle_with_previous' }))

    expect(auditoria.accion).toBe(ACCION_DE_TRASPASO)
    expect(auditoria.cambios.bookings_destination).toEqual({ antes: undefined, despues: 'cancel' })
    expect(auditoria.cambios.installments_destination).toEqual({ antes: undefined, despues: 'settle_with_previous' })
  })

  it('CA-09.5 · el registro guarda el cambio de titular y a qué propiedad pertenece', () => {
    const { auditoria } = planDeTraspaso(solicitud())

    expect(auditoria.cambios.owner_id).toEqual({ antes: ANTERIOR, despues: NUEVO })
    expect(auditoria.entidad).toEqual({ tipo: 'fraction', id: solicitud().fractionId })
    expect(auditoria.propiedadId).toBe(solicitud().propertyId)
  })

  it('RF-A.4 · el motivo viaja con la entrada', () => {
    expect(planDeTraspaso(solicitud()).auditoria.motivo).toBe('Cesión firmada ante notaría el 12 de agosto.')
  })

  it('RF-09.5 · «cancelar» marca las estadías futuras para cancelarse; «trasladar» no', () => {
    expect(planDeTraspaso(solicitud({ bookings: 'cancel' })).efectos.cancelFutureStays).toBe(true)
    expect(planDeTraspaso(solicitud({ bookings: 'transfer' })).efectos.cancelFutureStays).toBe(false)
  })

  it('RF-09.5 · las cuotas o siguen con la fracción o se le quedan al anterior titular', () => {
    expect(planDeTraspaso(solicitud({ installments: 'transfer' })).efectos.planOwnerId).toBe(NUEVO)
    expect(planDeTraspaso(solicitud({ installments: 'settle_with_previous' })).efectos.planOwnerId).toBe(ANTERIOR)
  })

  /**
   * D-31 · el derecho de uso no se marca a mano en ninguna operación: lo deriva el
   * plan de pagos (HU-58). El traspaso cambia el titular; si el calendario debe
   * abrirse o cerrarse, lo decide la derivación, no esta función.
   */
  it('D-31 · el traspaso no toca el interruptor de calendario', () => {
    const plan = planDeTraspaso(solicitud())

    expect(Object.keys(plan.efectos)).not.toContain('calendarActive')
    expect(plan.auditoria.cambios).not.toHaveProperty('calendar_active')
  })

  it('CA-09.5 · un traspaso inválido no llega a producir plan', () => {
    expect(() => planDeTraspaso(solicitud({ reason: '' }))).toThrow(RangeError)
  })
})
