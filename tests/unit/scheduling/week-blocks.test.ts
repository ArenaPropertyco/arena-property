import { describe, expect, it } from 'vitest'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import { blockConflicts, validateWeekBlock } from '#shared/scheduling/week-blocks'

/**
 * HU-15 · RF-15.1, RF-15.4 · D-33 — bloqueos del Administrador por semanas
 * completas de la rejilla, con motivo obligatorio, y el conflicto que dejan sobre
 * una semana ya confirmada.
 */

const rejilla = rejillaDelAnio(2027)
const classification = clasificacionBase(rejilla)
const TODAY = '2027-01-01'

describe('CA-15.1 · un bloqueo sin motivo se rechaza', () => {
  it('CA-15.1 · el motivo es obligatorio y los espacios no cuentan', () => {
    expect(validateWeekBlock({ weeks: [24], reason: '   ' }, { classification, rejilla, today: TODAY, blocked: new Set() }))
      .toEqual([{ name: 'motivo', message: 'calendar.blocks.validation.reason_required' }])
  })

  it('RF-15.1 · con motivo y semanas de la rejilla, futuras y libres, el bloqueo es válido', () => {
    expect(validateWeekBlock({ weeks: [24, 25], reason: 'Mantenimiento de piscina' }, { classification, rejilla, today: TODAY, blocked: new Set() })).toEqual([])
  })

  it('RF-15.1 · las semanas deben existir, no haber pasado ni estar ya bloqueadas', () => {
    const ctx = { classification, rejilla, today: '2027-07-01', blocked: new Set([30]) }
    expect(validateWeekBlock({ weeks: [], reason: 'Obra' }, ctx)).toEqual([{ name: 'semanas', message: 'calendar.blocks.validation.empty' }])
    expect(validateWeekBlock({ weeks: [99], reason: 'Obra' }, ctx)).toEqual([{ name: 'semanas', message: 'calendar.blocks.validation.week_unknown', weeks: [99] }])
    expect(validateWeekBlock({ weeks: [0], reason: 'Obra' }, ctx)).toEqual([{ name: 'semanas', message: 'calendar.blocks.validation.in_the_past', weeks: [0] }])
    expect(validateWeekBlock({ weeks: [30], reason: 'Obra' }, ctx)).toEqual([{ name: 'semanas', message: 'calendar.blocks.validation.already_blocked', weeks: [30] }])
  })
})

describe('CA-15.3 · un bloqueo sobre una semana confirmada no la elimina: genera el conflicto', () => {
  const confirmed = [{ fraction: 2, week: 24 }, { fraction: 5, week: 26 }]

  it('CA-15.3 · lista la fracción y la semana que colisionan', () => {
    expect(blockConflicts([24, 25], confirmed)).toEqual([{ fraction: 2, week: 24 }])
  })

  it('RF-15.4 · sin semanas confirmadas no hay conflicto', () => {
    expect(blockConflicts([27, 28], confirmed)).toEqual([])
  })
})
