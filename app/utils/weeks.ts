import type { Temporada } from '#shared/scheduling/temporadas'
import type { WeekCellType } from '#shared/scheduling/week-projection'
import type { WeekUsageState } from '#shared/scheduling/week-usage'

/**
 * HU-13 · RF-13.2, RF-13.3 · RT-06 — cómo se pinta cada semana del calendario, con
 * los tokens semánticos de `@nuxt/ui` para que valga en ambos temas. Las semanas
 * propias, ajenas, bloqueadas, en renta y de la bolsa se distinguen por color e
 * icono; la temporada, por su etiqueta.
 */
export const CLASS_BY_CELL_TYPE: Record<WeekCellType, string> = {
  own: 'border-primary/50 bg-primary/10',
  other: 'border-default bg-elevated',
  blocked: 'border-error/40 bg-error/10',
  rented: 'border-warning/40 bg-warning/10',
  pool: 'border-default bg-accented',
  free: 'border-dashed border-default',
}

export const ICON_BY_CELL_TYPE: Record<WeekCellType, string> = {
  own: 'i-lucide-home',
  other: 'i-lucide-users',
  blocked: 'i-lucide-lock',
  rented: 'i-lucide-key-round',
  pool: 'i-lucide-briefcase',
  free: 'i-lucide-circle-dashed',
}

export const COLOR_BY_SEASON: Record<Temporada, 'error' | 'warning' | 'info' | 'neutral'> = {
  alta: 'error',
  media_alta: 'warning',
  media: 'info',
  baja: 'neutral',
}

export const COLOR_BY_STATE: Record<WeekUsageState, 'warning' | 'success' | 'neutral' | 'error'> = {
  elected: 'warning',
  confirmed: 'success',
  used: 'neutral',
  released: 'error',
}
