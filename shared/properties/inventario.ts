/**
 * HU-26 · RF-26.1, RF-26.2, RF-26.4 — el inventario de una propiedad.
 *
 * Cada ítem lleva categoría, estado y cantidad (RF-26.1). No se borra: se da de
 * baja con motivo y el histórico se conserva (RF-26.2), en línea con la no
 * eliminación de HU-11. Los cambios de estado y de cantidad quedan historizados
 * con su antes y su después (RF-26.4); nombre, ubicación y notas se corrigen sin
 * dejar rastro, porque no describen el activo sino su ficha.
 *
 * Todo es puro; la base repite las mismas reglas con restricciones, un
 * disparador de histórico y una función de baja con motivo.
 */

/** RF-26.1 · mobiliario, equipamiento, insumos y lo que no encaja en ninguno. */
export const CATEGORIAS_DE_INVENTARIO = ['furniture', 'appliances', 'equipment', 'linens', 'supplies', 'other'] as const

export type CategoriaDeInventario = typeof CATEGORIAS_DE_INVENTARIO[number]

/** RF-26.1 · el estado físico del ítem. */
export const ESTADOS_DE_ITEM = ['new', 'good', 'fair', 'damaged'] as const

export type EstadoDeItem = typeof ESTADOS_DE_ITEM[number]

export const MAX_NOMBRE_DE_ITEM = 120

export interface NuevoItem {
  propertyId: string
  name: string
  category: CategoriaDeInventario
  condition: EstadoDeItem
  /** RF-26.1 · entero ≥ 0; cero es un ítem agotado, no inexistente. */
  quantity: number
  location: string | null
  notes: string | null
}

export interface ItemDeInventario extends NuevoItem {
  id: string
  createdAt: string
  updatedAt: string
  /** RF-26.2 · la baja lógica: fecha y motivo; `null` mientras siga activo. */
  retiredAt: string | null
  retireReason: string | null
}

export const CAMPOS_DE_ITEM = ['name', 'category', 'condition', 'quantity'] as const

export type CampoDeItem = typeof CAMPOS_DE_ITEM[number]

export const CLAVES_DE_VALIDACION_DE_ITEM = [
  'inventory.validation.name_required',
  'inventory.validation.category_required',
  'inventory.validation.condition_required',
  'inventory.validation.quantity_negative',
  'inventory.validation.quantity_not_integer',
  'inventory.validation.reason_required',
] as const

export type ClaveDeValidacionDeItem = typeof CLAVES_DE_VALIDACION_DE_ITEM[number]

export interface ErrorDeItem {
  name: CampoDeItem
  message: ClaveDeValidacionDeItem
}

/** CA-26.1 · RF-26.1 · qué ítem entra y cuál se rechaza, con su mensaje por campo. */
export function validarItem(item: NuevoItem): ErrorDeItem[] {
  const errores: ErrorDeItem[] = []

  const nombre = (item.name ?? '').trim()
  if (nombre === '' || nombre.length > MAX_NOMBRE_DE_ITEM) {
    errores.push({ name: 'name', message: 'inventory.validation.name_required' })
  }

  if (!(CATEGORIAS_DE_INVENTARIO as readonly string[]).includes(item.category)) {
    errores.push({ name: 'category', message: 'inventory.validation.category_required' })
  }

  if (!(ESTADOS_DE_ITEM as readonly string[]).includes(item.condition)) {
    errores.push({ name: 'condition', message: 'inventory.validation.condition_required' })
  }

  if (!Number.isInteger(item.quantity)) {
    errores.push({ name: 'quantity', message: 'inventory.validation.quantity_not_integer' })
  }
  else if (item.quantity < 0) {
    errores.push({ name: 'quantity', message: 'inventory.validation.quantity_negative' })
  }

  return errores
}

/** RF-26.2 · RF-A.4 · la baja exige motivo. */
export function validarBaja(motivo: string): ClaveDeValidacionDeItem[] {
  return motivo.trim() === '' ? ['inventory.validation.reason_required'] : []
}

/** CA-26.2 · los ítems que siguen en la propiedad; los dados de baja no se listan. */
export function itemsActivos(items: readonly ItemDeInventario[]): ItemDeInventario[] {
  return items.filter(item => item.retiredAt === null)
}

/** CA-26.2 · RF-26.2 · la baja lógica: marca fecha y motivo, no borra. Devuelve una copia. */
export function darDeBaja(item: ItemDeInventario, motivo: string, ahora: string): ItemDeInventario {
  if (item.retiredAt !== null) {
    return item
  }
  return { ...item, retiredAt: ahora, retireReason: motivo.trim(), updatedAt: ahora }
}

/** RF-26.4 · qué cambios se historizan: el estado, la cantidad y la baja. */
export const CAMPOS_HISTORIZADOS = ['condition', 'quantity', 'retired'] as const

export type CampoHistorizado = typeof CAMPOS_HISTORIZADOS[number]

export interface CambioDeItem {
  field: CampoHistorizado
  previous: string
  next: string
}

/** RF-26.4 · una entrada del histórico tal como la persiste la base. */
export interface EntradaDeHistorial extends CambioDeItem {
  id: string
  itemId: string
  changedAt: string
  /** Nombre o correo de quien hizo el cambio; `null` si fue el sistema. */
  changedByLabel: string | null
  note: string | null
}

/**
 * RF-26.4 · CA-26.2 · las entradas que deja pasar de `antes` a `despues`. Los
 * valores viajan como texto, que es como el histórico los guarda sea cual sea el
 * campo. Un cambio de nombre o de ubicación no produce nada.
 */
export function cambiosDeItem(antes: ItemDeInventario, despues: ItemDeInventario): CambioDeItem[] {
  const cambios: CambioDeItem[] = []

  if (antes.condition !== despues.condition) {
    cambios.push({ field: 'condition', previous: antes.condition, next: despues.condition })
  }
  if (antes.quantity !== despues.quantity) {
    cambios.push({ field: 'quantity', previous: String(antes.quantity), next: String(despues.quantity) })
  }
  if ((antes.retiredAt === null) !== (despues.retiredAt === null)) {
    cambios.push({
      field: 'retired',
      previous: antes.retiredAt === null ? 'active' : 'retired',
      next: despues.retiredAt === null ? 'active' : 'retired',
    })
  }

  return cambios
}
