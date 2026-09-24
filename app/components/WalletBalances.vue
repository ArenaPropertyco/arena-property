<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { colorDeCondicion } from '#shared/money/presentacion'
import type { CifraPresentada } from '#shared/money/presentacion'
import { walletFigures } from '#shared/referrals/wallet'
import type { WalletBalances } from '#shared/referrals/wallet'

/**
 * HU-55 · RF-55.1 · RF-55.5 · D-02 · TR-02 — las cuatro cifras de la billetera,
 * ya derivadas y ya condicionadas por `shared/referrals/wallet`: pendiente, en
 * gracia (con la fecha en que pasa a disponible), disponible y total ganado.
 *
 * Lo pendiente llega como estimado y se pinta como tal (RT-08): nunca se
 * confunde con lo que se puede retirar. Aquí no se suma nada ni se decide qué
 * es confirmado; solo se traduce la condición a color.
 */
const props = defineProps<{ balances: WalletBalances }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)
const cifras = computed(() => walletFigures(props.balances, idioma.value))

type Clave = keyof ReturnType<typeof walletFigures>

const TARJETAS: { clave: Clave, test: string, icono: string }[] = [
  { clave: 'pending', test: 'saldo-pendiente', icono: 'i-lucide-hourglass' },
  { clave: 'inGrace', test: 'saldo-en-gracia', icono: 'i-lucide-clock-3' },
  { clave: 'available', test: 'saldo-disponible', icono: 'i-lucide-banknote' },
  { clave: 'totalEarned', test: 'saldo-ganado', icono: 'i-lucide-trophy' },
]

/** El verde queda para lo confirmado y positivo; lo estimado va en rojo (principio 8). */
function clase(clave: Clave, cifra: CifraPresentada): string {
  if (!cifra.esConfirmado) {
    return `text-${colorDeCondicion(cifra.condicion)}`
  }
  if (clave === 'available' && props.balances.available > 0) {
    return `text-${colorDeCondicion(cifra.condicion)}`
  }
  return 'text-highlighted'
}
</script>

<template>
  <dl
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    data-test="saldos-billetera"
  >
    <div
      v-for="tarjeta in TARJETAS"
      :key="tarjeta.clave"
      class="rounded-2xl border border-default bg-default p-4"
      :data-test="tarjeta.test"
    >
      <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        <UIcon
          :name="tarjeta.icono"
          class="size-4"
        />
        {{ t(`wallet.balances.${tarjeta.clave}`) }}
      </dt>
      <dd
        class="mt-1 font-mono text-2xl"
        :class="clase(tarjeta.clave, cifras[tarjeta.clave])"
        :data-condicion="cifras[tarjeta.clave].condicion"
      >
        {{ cifras[tarjeta.clave].texto }}
      </dd>
      <p class="mt-1 text-xs text-muted">
        {{ t(`wallet.balances.${tarjeta.clave}Hint`) }}
      </p>
      <p
        v-if="tarjeta.clave === 'inGrace' && balances.nextAvailableOn"
        class="mt-1 text-xs text-warning"
        data-test="disponible-el"
      >
        {{ t('wallet.balances.availableOn', { date: formatearDia(balances.nextAvailableOn, idioma) }) }}
      </p>
    </div>
  </dl>
</template>
