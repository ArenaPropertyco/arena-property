import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { WeekUsageError } from '#shared/scheduling/week-usage'

/**
 * HU-14 · CA-14.4 — cada rechazo del motor llega con su clave i18n y los datos
 * que la explican (fecha límite, días). Aquí se convierten en el texto que ven
 * las personas, en su idioma y con las fechas en el formato del negocio.
 */
export function useWeekErrors() {
  const { t, locale } = useI18n()

  function translate(error: WeekUsageError): string {
    return t(error.message, {
      deadline: error.deadline ? formatearDia(error.deadline, locale.value as Idioma) : '',
      days: error.days ?? '',
    })
  }

  return { translate }
}
