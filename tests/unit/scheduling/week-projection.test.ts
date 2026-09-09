import { describe, expect, it } from 'vitest'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import { projectWeeks } from '#shared/scheduling/week-projection'
import type { WeekProjectionInput } from '#shared/scheduling/week-projection'

/**
 * HU-13 · RF-13.1b, RF-13.2, RF-13.3, RF-13.4 · D-16, D-31, D-33 — la proyección
 * del calendario por semanas es lógica pura: qué es cada semana para quien mira,
 * qué puede hacer con ella y cómo va su cupo por temporada.
 */

const rejilla = rejillaDelAnio(2027)
const classification: SemanaClasificada[] = clasificacionBase(rejilla).map(s => ({
  ...s,
  temporada: s.indice < 8 ? 'alta' : s.indice < 16 ? 'media_alta' : s.indice < 24 ? 'media' : 'baja',
}))

function input(changes: Partial<WeekProjectionInput> = {}): WeekProjectionInput {
  return {
    today: '2026-10-01',
    ownFraction: 3,
    calendarActive: true,
    activatedOn: null,
    rejilla,
    classification,
    allocations: [
      { fraction: 3, week: 0, confirmedAt: '2026-09-01T10:00:00Z', releasedAt: null, releaseReason: null },
      { fraction: 3, week: 8, confirmedAt: null, releasedAt: null, releaseReason: null },
      { fraction: 3, week: 16, confirmedAt: null, releasedAt: null, releaseReason: null },
      { fraction: 3, week: 24, confirmedAt: null, releasedAt: '2026-09-15T10:00:00Z', releaseReason: 'voluntary' },
      { fraction: 3, week: 25, confirmedAt: null, releasedAt: null, releaseReason: null },
      { fraction: 3, week: 26, confirmedAt: null, releasedAt: null, releaseReason: null },
      { fraction: 5, week: 1, confirmedAt: '2026-09-01T10:00:00Z', releasedAt: null, releaseReason: null },
      { fraction: 5, week: 9, confirmedAt: null, releasedAt: null, releaseReason: null },
    ],
    blocks: [{ week: 30, reason: 'Mantenimiento' }],
    selectionComplete: true,
    coOwners: [{ fraction: 3, name: 'Ana Ruiz' }, { fraction: 5, name: 'Luis Mora' }],
    ...changes,
  }
}

function cell(projection: ReturnType<typeof projectWeeks>, week: number) {
  const found = projection.cells.find(c => c.week === week)
  if (!found) throw new Error(`sin celda para la semana ${week}`)
  return found
}

describe('CA-13.1 · solo las semanas propias son accionables y el cupo es correcto', () => {
  it('CA-13.1 · hay una celda por semana de la rejilla, con su temporada', () => {
    const projection = projectWeeks(input())
    expect(projection.cells).toHaveLength(rejilla.length)
    expect(cell(projection, 0).season).toBe('alta')
    expect(cell(projection, 40).season).toBe('baja')
  })

  it('CA-13.1 · las semanas propias llevan su estado y solo las elegidas o confirmadas futuras son accionables', () => {
    const projection = projectWeeks(input())
    expect(cell(projection, 0)).toMatchObject({ type: 'own', state: 'confirmed', actionable: true })
    expect(cell(projection, 8)).toMatchObject({ type: 'own', state: 'elected', deadline: '2026-12-29', actionable: true })
    expect(cell(projection, 24)).toMatchObject({ type: 'rented', state: 'released', fraction: 3, actionable: false })
    expect(projection.cells.filter(c => c.actionable).map(c => c.week)).toEqual([0, 8, 16, 25, 26])
  })

  it('CA-13.1 · el cupo por temporada refleja elegidas, confirmadas y liberadas', () => {
    const projection = projectWeeks(input())
    expect(projection.quota.alta).toMatchObject({ required: 1, confirmed: 1 })
    expect(projection.quota.media).toMatchObject({ required: 1, elected: 1 })
    expect(projection.quota.baja).toMatchObject({ required: 3, elected: 2, released: 1 })
    expect(projection.pending.map(p => p.week)).toEqual([8, 16, 25, 26])
  })

  it('RF-13.2 · una semana propia confirmada que ya pasó figura como usada y no es accionable', () => {
    const projection = projectWeeks(input({ today: '2027-02-01' }))
    expect(cell(projection, 0)).toMatchObject({ state: 'used', actionable: false })
  })

  it('RF-13.3 · con la selección cerrada las semanas sin dueño son bolsa del Administrador; abierta, siguen libres', () => {
    expect(cell(projectWeeks(input()), 40).type).toBe('pool')
    expect(cell(projectWeeks(input({ selectionComplete: false })), 40).type).toBe('free')
  })
})

describe('CA-13.2 · las semanas ajenas muestran nombre y fracción, nunca contacto', () => {
  it('CA-13.2 · una semana de otra fracción lleva nombre y número del copropietario', () => {
    const projection = projectWeeks(input())
    expect(cell(projection, 1)).toMatchObject({ type: 'other', fraction: 5, ownerName: 'Luis Mora', state: 'confirmed', actionable: false })
    expect(cell(projection, 9)).toMatchObject({ type: 'other', fraction: 5, ownerName: 'Luis Mora', state: 'elected' })
  })

  it('CA-13.2 · ninguna celda expone correo ni teléfono', () => {
    for (const c of projectWeeks(input()).cells) {
      expect(Object.keys(c)).not.toContain('email')
      expect(Object.keys(c)).not.toContain('phone')
      expect(JSON.stringify(c)).not.toMatch(/@|\+57/)
    }
  })

  it('RF-13.3 · los bloqueos llevan su motivo y no son accionables', () => {
    expect(cell(projectWeeks(input()), 30)).toMatchObject({ type: 'blocked', reason: 'Mantenimiento', actionable: false })
  })
})

describe('RF-13.1b · D-31 · con el calendario inactivo la vista es de solo lectura', () => {
  it('RF-13.1b · se ven las semanas propias y ajenas pero ninguna es accionable', () => {
    const projection = projectWeeks(input({ calendarActive: false }))
    expect(projection.readOnly).toBe(true)
    expect(projection.cells.some(c => c.type === 'own')).toBe(true)
    expect(projection.cells.filter(c => c.actionable)).toEqual([])
  })

  it('RF-13.1 · quien no tiene fracción ve el calendario entero sin nada accionable', () => {
    const projection = projectWeeks(input({ ownFraction: null }))
    expect(projection.cells.filter(c => c.type === 'own')).toEqual([])
    expect(projection.cells.filter(c => c.actionable)).toEqual([])
    expect(projection.readOnly).toBe(true)
  })
})
