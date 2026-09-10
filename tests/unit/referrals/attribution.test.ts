import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTION_WINDOW_DAYS,
  attributionErrorKey,
  generatesCommission,
  isSelfReferral,
  markCommissioned,
  nextStage,
  REFERRAL_STAGES,
  resolveAttribution,
  withinWindow,
} from '#shared/referrals/attribution'
import type { Attribution, AttributionContext, ReferralClick } from '#shared/referrals/attribution'

/**
 * HU-51 · RF-51.1…RF-51.7 · D-03, D-04 — la atribución del referido.
 *
 * Ana (`ARENA234`) y Luis (`BOCA789`) son Embajadores. El prospecto es
 * `prospecto@correo.co`, que se registra el 10 de septiembre de 2026. La ventana
 * de 90 días corre desde cada clic; la primera atribución válida gana y nadie se
 * refiere a sí mismo.
 */

const REGISTRO = '2026-09-10'

function context(changes: Partial<AttributionContext> = {}): AttributionContext {
  return {
    codes: [
      { code: 'ARENA234', ambassadorId: 'amb-ana', ownerEmail: 'ana@correo.co', enabled: true },
      { code: 'BOCA789', ambassadorId: 'amb-luis', ownerEmail: 'luis@correo.co', enabled: true },
    ],
    prospectEmail: 'prospecto@correo.co',
    prospectId: 'user-prospecto',
    registeredAt: REGISTRO,
    ...changes,
  }
}

function click(code: string, clickedAt: string): ReferralClick {
  return { code, clickedAt }
}

function attribution(changes: Partial<Attribution> = {}): Attribution {
  return {
    id: 'atr-1',
    ambassadorId: 'amb-ana',
    code: 'ARENA234',
    prospectId: 'user-prospecto',
    prospectEmail: 'prospecto@correo.co',
    clickedAt: '2026-08-01',
    registeredAt: REGISTRO,
    stage: 'registered',
    commissionedPurchaseId: null,
    ...changes,
  }
}

describe('CA-51.1 · RF-51.3 · la primera atribución gana', () => {
  it('CA-51.1 · quien entra con el código A y luego con el B queda atribuido a A', () => {
    const clics = [click('ARENA234', '2026-08-01'), click('BOCA789', '2026-09-01')]
    expect(resolveAttribution(clics, context())).toEqual({
      attributed: true,
      ambassadorId: 'amb-ana',
      code: 'ARENA234',
      clickedAt: '2026-08-01',
    })
  })

  it('RF-51.3 · el orden lo marca la fecha del clic, no el orden en que lleguen los datos', () => {
    const clics = [click('BOCA789', '2026-09-01'), click('ARENA234', '2026-08-01')]
    expect(resolveAttribution(clics, context())).toMatchObject({ attributed: true, code: 'ARENA234' })
  })

  it('RF-51.1 · sin ningún clic no hay atribución y el flujo sigue', () => {
    expect(resolveAttribution([], context())).toEqual({ attributed: false, reason: 'no_code' })
  })
})

describe('CA-51.6 · RF-51.1 · D-03 · la ventana de 90 días', () => {
  it('CA-51.6 · un clic de hace 89 días atribuye; uno de hace 91, no', () => {
    expect(ATTRIBUTION_WINDOW_DAYS).toBe(90)
    expect(resolveAttribution([click('ARENA234', '2026-06-13')], context())).toMatchObject({ attributed: true })
    expect(resolveAttribution([click('ARENA234', '2026-06-11')], context())).toEqual({ attributed: false, reason: 'window_expired' })
  })

  it('CA-51.6 · justo a los 90 días todavía atribuye', () => {
    expect(withinWindow('2026-06-12', REGISTRO)).toBe(true)
    expect(withinWindow('2026-06-11', REGISTRO)).toBe(false)
    expect(withinWindow('2026-09-10', REGISTRO)).toBe(true)
  })

  it('CA-51.6 · un clic caducado no impide que uno posterior y válido atribuya', () => {
    const clics = [click('ARENA234', '2026-01-01'), click('BOCA789', '2026-09-01')]
    expect(resolveAttribution(clics, context())).toMatchObject({ attributed: true, code: 'BOCA789' })
  })
})

describe('CA-51.2 · RF-51.4 · sin auto-referencia', () => {
  it('CA-51.2 · un Embajador que usa su propio código no crea atribución', () => {
    expect(resolveAttribution([click('ARENA234', '2026-09-01')], context({ prospectEmail: 'ana@correo.co' })))
      .toEqual({ attributed: false, reason: 'self_referral' })
  })

  it('CA-51.2 · el mismo correo cuenta como la misma persona, sin importar mayúsculas ni espacios', () => {
    expect(isSelfReferral('  Ana@Correo.CO ', 'ana@correo.co')).toBe(true)
    expect(isSelfReferral('ana@correo.co', 'prospecto@correo.co')).toBe(false)
  })

  it('CA-51.2 · si el prospecto es el propio Embajador, el siguiente código sí atribuye', () => {
    const clics = [click('ARENA234', '2026-09-01'), click('BOCA789', '2026-09-02')]
    expect(resolveAttribution(clics, context({ prospectEmail: 'ana@correo.co' })))
      .toMatchObject({ attributed: true, code: 'BOCA789' })
  })
})

describe('CA-51.5 · RF-51.6 · un código inválido o inhabilitado no bloquea el flujo', () => {
  it('CA-51.5 · con el código inhabilitado el registro procede sin atribución', () => {
    const codes = context().codes.map(c => c.code === 'ARENA234' ? { ...c, enabled: false } : c)
    expect(resolveAttribution([click('ARENA234', '2026-09-01')], context({ codes })))
      .toEqual({ attributed: false, reason: 'disabled_code' })
  })

  it('CA-51.5 · un código inexistente o con formato roto tampoco crea atribución ni rompe nada', () => {
    expect(resolveAttribution([click('NOEXISTE', '2026-09-01')], context())).toEqual({ attributed: false, reason: 'unknown_code' })
    expect(resolveAttribution([click('??', '2026-09-01')], context())).toEqual({ attributed: false, reason: 'unknown_code' })
  })

  it('CA-51.5 · un código inhabilitado no impide que otro válido atribuya', () => {
    const codes = context().codes.map(c => c.code === 'ARENA234' ? { ...c, enabled: false } : c)
    const clics = [click('ARENA234', '2026-09-01'), click('BOCA789', '2026-09-02')]
    expect(resolveAttribution(clics, context({ codes }))).toMatchObject({ attributed: true, code: 'BOCA789' })
  })
})

describe('CA-51.3 · CA-51.4 · RF-51.5 · el ciclo de vida del referido', () => {
  it('CA-51.3 · el referido avanza con la compra: registrado, en pago y pagado', () => {
    expect(REFERRAL_STAGES).toEqual(['registered', 'payment_in_progress', 'paid'])
    expect(nextStage('registered', 'purchase_started')).toBe('payment_in_progress')
    expect(nextStage('payment_in_progress', 'payment_completed')).toBe('paid')
  })

  it('CA-51.3 · anular la compra devuelve el referido a registrado', () => {
    expect(nextStage('payment_in_progress', 'purchase_voided')).toBe('registered')
  })

  it('CA-51.4 · saltarse la compra se rechaza', () => {
    expect(nextStage('registered', 'payment_completed')).toBeNull()
  })

  it('CA-51.4 · las demás transiciones inválidas también se rechazan', () => {
    expect(nextStage('paid', 'purchase_started')).toBeNull()
    expect(nextStage('paid', 'payment_completed')).toBeNull()
    expect(nextStage('registered', 'purchase_voided')).toBeNull()
    expect(nextStage('payment_in_progress', 'purchase_started')).toBeNull()
  })
})

describe('CA-51.7 · RF-51.7 · D-04 · una sola comisión por prospecto', () => {
  it('CA-51.7 · la primera compra genera comisión y la segunda ya no', () => {
    const primera = attribution({ stage: 'paid' })
    expect(generatesCommission(primera, 'plan-1')).toBe(true)

    const marcada = markCommissioned(primera, 'plan-1')
    expect(marcada.commissionedPurchaseId).toBe('plan-1')
    expect(generatesCommission(marcada, 'plan-2')).toBe(false)
    // Marcar no muta la atribución original.
    expect(primera.commissionedPurchaseId).toBeNull()
  })

  it('CA-51.7 · reintentar la misma compra tampoco genera una segunda comisión', () => {
    const marcada = markCommissioned(attribution({ stage: 'paid' }), 'plan-1')
    expect(generatesCommission(marcada, 'plan-1')).toBe(false)
  })

  it('RF-51.7 · sin el pago completo no hay comisión que generar', () => {
    expect(generatesCommission(attribution({ stage: 'registered' }), 'plan-1')).toBe(false)
    expect(generatesCommission(attribution({ stage: 'payment_in_progress' }), 'plan-1')).toBe(false)
  })
})

describe('RF-51.6 · el rechazo de la base se traduce a su motivo', () => {
  it('reconoce la regla por su código en el mensaje', () => {
    expect(attributionErrorKey('CA-51.2 · RF-51.4 · nadie se refiere a sí mismo.')).toBe('referrals.attribution.validation.self_referral')
    expect(attributionErrorKey('CA-51.5 · RF-51.6 · el código ARENA234 está inhabilitado.')).toBe('referrals.attribution.validation.disabled_code')
    expect(attributionErrorKey('CA-51.6 · RF-51.1 · el primer clic quedó fuera de la ventana de 90 días.')).toBe('referrals.attribution.validation.window_expired')
    expect(attributionErrorKey('CA-51.4 · RF-51.5 · la transición del referido no es válida.')).toBe('referrals.attribution.validation.invalid_transition')
    expect(attributionErrorKey('algo inesperado')).toBeNull()
  })
})
