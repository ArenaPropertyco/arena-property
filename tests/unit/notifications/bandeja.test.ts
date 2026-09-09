import { describe, expect, it } from 'vitest'
import {
  filtrarBandeja,
  filtroDeBandejaVacio,
  marcarLeida,
  marcarTodasLeidas,
  noLeidas,
  propiedadesDe,
} from '#shared/notifications/bandeja'
import type { ItemDeBandeja } from '#shared/notifications/bandeja'

/**
 * TR-03 · RF-N.5 — la bandeja como funciones puras: contador, marcar y filtrar.
 * El estado leído es por destinatario: cada bandeja es la de una sola cuenta.
 */

function item(cambios: Partial<ItemDeBandeja> & { id: string }): ItemDeBandeja {
  return {
    notificationId: `n-${cambios.id}`,
    kind: 'announcement_published',
    propertyId: 'p1',
    propertyName: 'Casa Arena',
    payload: {},
    createdAt: '2026-09-08T10:00:00Z',
    readAt: null,
    ...cambios,
  }
}

const bandejaDeAna = [item({ id: '1' }), item({ id: '2' }), item({ id: '3', kind: 'calendar_activated', propertyId: 'p2', propertyName: 'Invictvs' })]
const bandejaDeLuis = [item({ id: '4' }), item({ id: '5' }), item({ id: '6' })]

describe('CA-N.4 · marcar como leída es por destinatario', () => {
  it('CA-N.4 · con 3 no leídas, marcar una baja el contador a 2 y no toca la bandeja de los demás', () => {
    expect(noLeidas(bandejaDeAna)).toBe(3)

    const despues = marcarLeida(bandejaDeAna, '2', '2026-09-08T11:00:00Z')

    expect(noLeidas(despues)).toBe(2)
    expect(despues.find(i => i.id === '2')?.readAt).toBe('2026-09-08T11:00:00Z')
    expect(noLeidas(bandejaDeLuis)).toBe(3)
  })

  it('marcar una ya leída no la cambia ni altera el contador', () => {
    const una = marcarLeida(bandejaDeAna, '2', '2026-09-08T11:00:00Z')
    const otraVez = marcarLeida(una, '2', '2026-09-09T11:00:00Z')

    expect(otraVez.find(i => i.id === '2')?.readAt).toBe('2026-09-08T11:00:00Z')
    expect(noLeidas(otraVez)).toBe(2)
  })

  it('RF-30.2 · marcar todas deja el contador en cero', () => {
    expect(noLeidas(marcarTodasLeidas(bandejaDeAna, '2026-09-08T12:00:00Z'))).toBe(0)
  })

  it('la función no muta la bandeja original', () => {
    marcarLeida(bandejaDeAna, '1', '2026-09-08T11:00:00Z')
    expect(noLeidas(bandejaDeAna)).toBe(3)
  })
})

describe('RF-N.5 · filtro por propiedad y por tipo', () => {
  it('CA-30.2 · con filtro por propiedad P solo quedan las ligadas a P', () => {
    expect(filtrarBandeja(bandejaDeAna, { ...filtroDeBandejaVacio(), propertyId: 'p2' }).map(i => i.id)).toEqual(['3'])
  })

  it('el filtro por tipo y el de no leídas se combinan', () => {
    const leida = marcarLeida(bandejaDeAna, '1', '2026-09-08T11:00:00Z')
    expect(filtrarBandeja(leida, { ...filtroDeBandejaVacio(), kind: 'announcement_published', soloNoLeidas: true }).map(i => i.id)).toEqual(['2'])
  })

  it('las opciones de propiedad salen de la bandeja, sin repetir', () => {
    expect(propiedadesDe(bandejaDeAna)).toEqual([{ id: 'p1', name: 'Casa Arena' }, { id: 'p2', name: 'Invictvs' }])
  })
})
