<script setup lang="ts">
import { formatearMes } from '#shared/dates/formato'
import { colorDeSaldo, figuraDeSaldo } from '#shared/finance/billetera'
import type { SaldoDePropiedad } from '#shared/finance/billetera'
import type { Mes } from '#shared/finance/estado-de-cuenta'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-62 · RF-62.1 · RF-62.10 · D-51 · TR-02 — el saldo de cada propiedad y el
 * total consolidado, ya derivados y ya condicionados por `shared/finance/billetera`.
 *
 * Un saldo cerrado va en rojo si se debe y en verde si se puede retirar; el mes
 * en curso llega como estimado y se pinta como tal (RT-08): nunca en verde. Aquí
 * no se suma nada ni se decide qué es confirmado; solo se traduce la condición.
 */
const props = defineProps<{
  saldos: SaldoDePropiedad[]
  consolidado: CopAmount
  /** CA-62.12 · el estimado del mes en curso por propiedad, si hay cuotas vivas. */
  estimados: Record<string, CopAmount>
  mesEnCurso: Mes
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const ICONO: Record<SaldoDePropiedad['nature'], string> = {
  charge: 'i-lucide-alert-circle',
  payout: 'i-lucide-banknote',
  settled: 'i-lucide-check-circle-2',
}

function claseDeSaldo(saldo: SaldoDePropiedad): string {
  const color = colorDeSaldo(saldo.balance, true)
  return color === 'neutral' ? 'text-highlighted' : `text-${color}`
}

const tarjetas = computed(() => props.saldos.map(saldo => ({
  ...saldo,
  cifra: figuraDeSaldo(saldo.balance, true, idioma.value),
  estimado: saldo.propertyId in props.estimados ? figuraDeSaldo(props.estimados[saldo.propertyId]!, false, idioma.value) : null,
})))

const total = computed(() => figuraDeSaldo(props.consolidado, true, idioma.value))
</script>

<template>
  <div
    class="space-y-3"
    data-test="saldos-propietario"
  >
    <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="tarjeta in tarjetas"
        :key="tarjeta.propertyId"
        class="rounded-2xl border border-default bg-default p-4"
        :data-test="`saldo-propiedad-${tarjeta.propertyId}`"
      >
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <UIcon
            :name="ICONO[tarjeta.nature]"
            class="size-4"
          />
          {{ tarjeta.propertyName }}
        </dt>
        <dd
          class="mt-1 font-mono text-2xl"
          :class="claseDeSaldo(tarjeta)"
          :data-condicion="tarjeta.cifra.condicion"
        >
          {{ tarjeta.cifra.texto }}
        </dd>
        <p class="mt-1 text-xs text-muted">
          {{ t(`ownerWallet.balances.nature.${tarjeta.nature}`) }}
        </p>
        <p
          v-if="tarjeta.estimado"
          class="mt-2 font-mono text-xs text-muted"
          :data-condicion="tarjeta.estimado.condicion"
          :data-test="`estimado-${tarjeta.propertyId}`"
        >
          {{ t('ownerWallet.balances.currentMonth', { amount: tarjeta.estimado.texto }) }}
          <span class="font-sans">· {{ formatearMes(mesEnCurso, idioma) }}</span>
        </p>
      </div>

      <div
        class="rounded-2xl border border-dashed border-default bg-elevated/40 p-4"
        data-test="saldo-consolidado"
      >
        <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-sigma"
            class="size-4"
          />
          {{ t('ownerWallet.balances.consolidated') }}
        </dt>
        <dd
          class="mt-1 font-mono text-2xl text-highlighted"
          :data-condicion="total.condicion"
        >
          {{ total.texto }}
        </dd>
        <p class="mt-1 text-xs text-muted">
          {{ t('ownerWallet.balances.consolidatedHint') }}
        </p>
      </div>
    </dl>
  </div>
</template>
