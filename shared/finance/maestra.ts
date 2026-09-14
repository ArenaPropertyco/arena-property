/**
 * HU-23 · RF-23.1, RF-23.5 · D-01 — la maestra contable.
 *
 * Todo movimiento financiero referencia obligatoriamente entradas de la maestra:
 * una categoría, un medio de pago y una cuenta contable. El catálogo vive en la
 * base (`expense_categories`, `payment_methods`, `ledger_accounts`) y lo administra
 * el Superadmin; aquí solo se modela y se filtra.
 *
 * El ámbito de la categoría es la traducción de D-01: las comisiones a Embajadores
 * son costo de plataforma, viven en el libro de plataforma (HU-25) y **jamás** se
 * prorratean entre las fracciones. Una categoría `platform` existe en la maestra
 * para que ese libro la use, pero un movimiento de propiedad no puede referenciarla.
 */

export const CLASES_DE_MOVIMIENTO = ['expense', 'income'] as const
export type ClaseDeMovimiento = typeof CLASES_DE_MOVIMIENTO[number]

/** D-01 · a qué libro pertenece una categoría: al de la propiedad o al de Arena. */
export const AMBITOS_DE_CATEGORIA = ['property', 'platform'] as const
export type AmbitoDeCategoria = typeof AMBITOS_DE_CATEGORIA[number]

export interface CategoriaContable {
  id: string
  name: string
  kind: ClaseDeMovimiento
  scope: AmbitoDeCategoria
  /** Una entrada inactiva no se ofrece para movimientos nuevos, pero los antiguos la conservan. */
  active: boolean
}

export interface MedioDePago {
  id: string
  /** Identificador estable (`transfer`, `cash`…) para que la interfaz lo traduzca si quiere. */
  code: string
  name: string
  active: boolean
}

export interface CuentaContable {
  id: string
  code: string
  name: string
  active: boolean
}

export interface MaestraContable {
  categorias: CategoriaContable[]
  medios: MedioDePago[]
  cuentas: CuentaContable[]
}

/** RF-23.5 · D-01 · ¿la categoría pertenece al libro de la propiedad? */
export function esCategoriaDePropiedad(categoria: CategoriaContable): boolean {
  return categoria.scope === 'property'
}

/** Categorías que se ofrecen para un movimiento de propiedad de la clase dada. */
export function categoriasPara(categorias: readonly CategoriaContable[], clase: ClaseDeMovimiento): CategoriaContable[] {
  return categorias.filter(categoria => categoria.active && categoria.kind === clase && esCategoriaDePropiedad(categoria))
}

/** Medios de pago que se ofrecen para un movimiento nuevo. */
export function mediosActivos(medios: readonly MedioDePago[]): MedioDePago[] {
  return medios.filter(medio => medio.active)
}

/** Cuentas contables que se ofrecen para un movimiento nuevo. */
export function cuentasActivas(cuentas: readonly CuentaContable[]): CuentaContable[] {
  return cuentas.filter(cuenta => cuenta.active)
}
