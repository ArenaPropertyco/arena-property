<script setup lang="ts">
import type { DetalleDeCuota } from '#shared/finance/detalle'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte, formatearPorcentaje } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-24 · RF-24.1, RF-24.2, RF-24.2b, RF-24.2c — el detalle de cómo se calculó una
 * cuota.
 *
 * El detalle llega armado por `shared/finance/detalle`: aquí no se decide nada ni se
 * calcula nada. La fórmula «÷ 8» solo existe en la variante prorrateada, así que
 * sobre una cuota imputada o atribuida esta vista **no puede** mostrarla ni por
 * descuido: el campo no está en el objeto (principio 9).
 */
const props = defineProps<{ detalle: DetalleDeCuota }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function importe(valor: number): string {
  return formatearImporte(valor as never, idioma.value)
}
</script>

<template>
  <div class="space-y-4 text-sm">
    <div class="space-y-1">
      <p class="text-muted">
        {{ t('finance.detail.movement') }}
      </p>
      <p class="text-default">
        {{ props.detalle.description }}
      </p>
      <p class="text-xs text-muted">
        {{ props.detalle.categoryName }} · {{ props.detalle.propertyName }} ·
        {{ formatearDia(props.detalle.incurredOn, idioma) }}
      </p>
    </div>

    <template v-if="props.detalle.naturaleza === 'prorated'">
      <div class="flex items-center justify-between">
        <span class="text-muted">{{ t('finance.detail.originalAmount') }}</span>
        <span
          class="font-mono"
          data-test="monto-original"
        >{{ importe(props.detalle.montoOriginal) }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted">{{ t('finance.detail.formula') }}</span>
        <span
          class="font-mono"
          data-test="formula"
        >{{ props.detalle.formula }}</span>
      </div>
      <p
        v-if="props.detalle.conResiduo"
        class="text-xs text-primary"
        data-test="residuo"
      >
        {{ t('finance.detail.remainder', { amount: importe(props.detalle.residuo) }) }}
      </p>
    </template>

    <template v-else-if="props.detalle.naturaleza === 'imputed'">
      <p
        class="text-default"
        data-test="imputado"
      >
        {{ t('finance.detail.imputed', { fraction: props.detalle.fraction }) }}
      </p>
      <div class="flex items-center justify-between">
        <span class="text-muted">{{ t('finance.detail.originalAmount') }}</span>
        <span
          class="font-mono"
          data-test="monto-original"
        >{{ importe(props.detalle.montoOriginal) }}</span>
      </div>
    </template>

    <template v-else>
      <p
        class="text-default"
        data-test="atribuido"
      >
        {{ t('finance.detail.attributed', { fraction: props.detalle.fraction }) }}
      </p>
      <p
        v-if="props.detalle.semana"
        class="text-xs text-muted"
        data-test="semana"
      >
        {{ t('finance.detail.week', {
          number: props.detalle.semana.indice,
          from: formatearDia(props.detalle.semana.empiezaEl, idioma),
        }) }}
      </p>
      <div class="flex items-center justify-between">
        <span class="text-muted">{{ t('finance.detail.gross') }}</span>
        <span
          class="font-mono"
          data-test="bruto"
        >{{ importe(props.detalle.bruto) }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted">
          {{ t('finance.detail.commission', { percent: formatearPorcentaje(props.detalle.comisionPuntosBasicos, idioma) }) }}
        </span>
        <span
          class="font-mono text-muted"
          data-test="comision"
        >− {{ importe(props.detalle.comision) }}</span>
      </div>
      <div class="flex items-center justify-between border-t border-default pt-2">
        <span class="text-muted">{{ t('finance.detail.net') }}</span>
        <span
          class="font-mono text-default"
          data-test="neto"
        >{{ importe(props.detalle.neto) }}</span>
      </div>
    </template>

    <div
      v-if="props.detalle.naturaleza !== 'attributed'"
      class="flex items-center justify-between border-t border-default pt-2"
    >
      <span class="text-muted">{{ t('finance.detail.share') }}</span>
      <span
        class="font-mono text-default"
        data-test="cuota"
      >{{ importe(props.detalle.cuota) }}</span>
    </div>
  </div>
</template>
