import { describe, expect, it } from 'vitest'
import { categoriasPara, esCategoriaDePropiedad } from '#shared/finance/maestra'
import type { CategoriaContable } from '#shared/finance/maestra'

/**
 * HU-23 · RF-23.1, RF-23.5 · D-01 — la maestra contable vista desde el dominio:
 * qué categorías se ofrecen para un gasto de propiedad y cuáles quedan fuera.
 */

const categorias: CategoriaContable[] = [
  { id: 'a', name: 'Mantenimiento', kind: 'expense', scope: 'property', active: true },
  { id: 'b', name: 'Servicios públicos', kind: 'expense', scope: 'property', active: true },
  { id: 'c', name: 'Renta a terceros', kind: 'income', scope: 'property', active: true },
  { id: 'd', name: 'Comisiones a Embajadores', kind: 'expense', scope: 'platform', active: true },
  { id: 'e', name: 'Retirada', kind: 'expense', scope: 'property', active: false },
]

describe('RF-23.1 · la maestra ofrece solo lo que aplica', () => {
  it('para un gasto: categorías de egreso, de la propiedad y activas', () => {
    expect(categoriasPara(categorias, 'expense').map(categoria => categoria.id)).toEqual(['a', 'b'])
  })

  it('para un ingreso: las de ingreso de la propiedad', () => {
    expect(categoriasPara(categorias, 'income').map(categoria => categoria.id)).toEqual(['c'])
  })

  it('CA-23.6 · la categoría del libro de plataforma no es de la propiedad (D-01)', () => {
    expect(esCategoriaDePropiedad(categorias[3]!)).toBe(false)
    expect(esCategoriaDePropiedad(categorias[0]!)).toBe(true)
  })
})
