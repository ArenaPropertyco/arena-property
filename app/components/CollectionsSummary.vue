<script setup lang="ts">
import { colorDeSaldo, figuraDeSaldo } from '#shared/finance/billetera'
import type { ResumenDelTablero } from '#shared/finance/tablero-de-cobros'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-63 · RF-63.3 · TR-02 · RT-08 — el resumen de la propiedad en el mes, ya
 * sumado por `shared/finance/tablero-de-cobros`: ingresos y gastos del mes, por
 * cobrar, cobrado y confirmado, en revisión (aparte, nunca sumado a lo
 * cobrado), por pagar a las fracciones y el neto de caja.
 */
const props = defineProps<{
  resumen: ResumenDelTablero
  /** RF-63.2 · el mes en curso: las cifras del mes son estimadas. */
  estimado: boolean
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

interface Tarjeta {
  clave: keyof ResumenDelTablero
  test: string
  icono: string
  /** Solo el neto del mes y el neto de caja llevan color por signo. */
  conSigno: boolean
  delMes: boolean
}

const TARJETAS: Tarjeta[] = [
  { clave: 'receivable', test: 'por-cobrar', icono: 'i-lucide-alert-circle', conSigno: false, delMes: false },
  { clave: 'collected', test: 'cobrado', icono: 'i-lucide-check-circle-2', conSigno: false, delMes: false },
  { clave: 'underReview', test: 'en-revision', icono: 'i-lucide-hourglass', conSigno: false, delMes: false },
  { clave: 'payable', test: 'por-pagar', icono: 'i-lucide-banknote', conSigno: false, delMes: false },
  { clave: 'income', test: 'ingresos', icono: 'i-lucide-trending-up', conSigno: false, delMes: true },
  { clave: 'expenses', test: 'gastos', icono: 'i-lucide-trending-down', conSigno: false, delMes: true },
  { clave: 'cashNet', test: 'neto-de-caja', icono: 'i-lucide-sigma', conSigno: true, delMes: false },
]

function cifra(tarjeta: Tarjeta) {
  const valor: CopAmount = props.resumen[tarjeta.clave]
  const cerrado = !(tarjeta.delMes && props.estimado)
  const color = tarjeta.conSigno ? colorDeSaldo(valor, cerrado) : 'neutral'
  return { ...figuraDeSaldo(valor, cerrado, idioma.value), clase: color === 'neutral' ? 'text-highlighted' : `text-${color}` }
}
</script>

<template>
  <dl
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    data-test="resumen-del-tablero"
  >
    <div
      v-for="tarjeta in TARJETAS"
      :key="tarjeta.clave"
      class="rounded-2xl border border-default bg-default p-4"
      :data-test="`resumen-${tarjeta.test}`"
    >
      <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        <UIcon
          :name="tarjeta.icono"
          class="size-4"
        />
        {{ t(`collections.summary.${tarjeta.clave}`) }}
      </dt>
      <dd
        class="mt-1 font-mono text-2xl"
        :class="cifra(tarjeta).clase"
        :data-condicion="cifra(tarjeta).condicion"
      >
        {{ cifra(tarjeta).texto }}
      </dd>
      <p
        v-if="tarjeta.clave === 'underReview'"
        class="mt-1 text-xs text-muted"
      >
        {{ t('collections.summary.underReviewHint') }}
      </p>
      <p
        v-else-if="tarjeta.clave === 'cashNet'"
        class="mt-1 text-xs text-muted"
      >
        {{ t('collections.summary.cashNetHint') }}
      </p>
      <p
        v-else-if="tarjeta.delMes && estimado"
        class="mt-1 text-xs text-muted"
      >
        {{ t('collections.estimated') }}
      </p>
    </div>
  </dl>
</template>
