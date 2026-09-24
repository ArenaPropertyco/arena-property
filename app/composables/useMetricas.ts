import { calcularKpis } from '#shared/metrics/kpis'
import type { DatosDeKpis } from '#shared/metrics/kpis'
import { agregarSerie } from '#shared/metrics/series'
import type { EventoDeSerie, Periodo } from '#shared/metrics/series'
import type { Idioma } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { Database } from '#shared/types/database.types'

/**
 * HU-32 · RF-32.1…RF-32.4 — el dashboard global del Superadmin.
 *
 * Orquesta, no calcula: pide a la base los conteos, las sumas por estado y las
 * dos series crudas (`platform_metrics`, que ya exigió ser Superadmin y miró toda
 * la plataforma), y se los pasa a `shared/metrics`, que deriva el porcentaje y
 * arma los buckets del periodo elegido. Cambiar de periodo no vuelve a consultar.
 */

interface MetricasCrudas {
  properties: number
  fractions_total: number
  fractions_sold: number
  active_admins: number
  owners: number
  active_ambassadors: number
  commissions: { pending: number, in_grace: number, available: number, withdrawn: number }
  sales: { on: string }[]
  commission_events: { on: string, amount: number }[]
}

export function useMetricas() {
  const client = useSupabaseClient<Database>()
  const { locale } = useI18n()
  const idioma = computed(() => locale.value as Idioma)

  const consulta = useAsyncData<MetricasCrudas | null>('metricas-globales', async () => {
    const { data, error } = await client.rpc('platform_metrics')
    if (error || !data) {
      return null
    }
    return data as unknown as MetricasCrudas
  })

  const periodo = ref<Periodo>('monthly')

  const datos = computed<DatosDeKpis | null>(() => {
    const crudas = consulta.data.value
    if (!crudas) {
      return null
    }
    return {
      properties: crudas.properties,
      fractionsTotal: crudas.fractions_total,
      fractionsSold: crudas.fractions_sold,
      activeAdmins: crudas.active_admins,
      owners: crudas.owners,
      activeAmbassadors: crudas.active_ambassadors,
      commissions: {
        pending: pesos(crudas.commissions.pending),
        inGrace: pesos(crudas.commissions.in_grace),
        available: pesos(crudas.commissions.available),
        withdrawn: pesos(crudas.commissions.withdrawn),
      },
    }
  })

  const ventas = computed<EventoDeSerie[]>(() => (consulta.data.value?.sales ?? []).map(venta => ({ on: venta.on, value: 1 })))
  const comisiones = computed<EventoDeSerie[]>(() => (consulta.data.value?.commission_events ?? []).map(evento => ({ on: evento.on, value: evento.amount })))

  return {
    periodo,
    kpis: computed(() => (datos.value ? calcularKpis(datos.value) : null)),
    serieDeVentas: computed(() => agregarSerie(ventas.value, periodo.value, undefined, idioma.value)),
    serieDeComisiones: computed(() => agregarSerie(comisiones.value, periodo.value, undefined, idioma.value)),
    pendiente: consulta.pending,
    error: computed(() => !consulta.pending.value && consulta.data.value === null),
    recargar: consulta.refresh,
  }
}
