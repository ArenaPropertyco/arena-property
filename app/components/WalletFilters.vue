<script setup lang="ts">
import { emptyWalletFilter, WALLET_ENTRY_KINDS } from '#shared/referrals/wallet'
import type { WalletEntryKind, WalletFilter } from '#shared/referrals/wallet'

/**
 * HU-55 · RF-55.3 — filtros del histórico de la billetera: tipo de movimiento y
 * periodo, combinables. Controlado: recibe el filtro y emite el completo con
 * cada cambio; filtrar lo hace `shared/referrals/wallet`.
 */
const props = defineProps<{ filtro: WalletFilter }>()

const emit = defineEmits<{ 'update:filtro': [WalletFilter] }>()

const { t } = useI18n()

/** El selector no admite el vacío como valor: «todos» viaja como centinela. */
const TODOS = '__todos__'

const tipos = computed(() => [
  { label: t('wallet.filters.allKinds'), value: TODOS },
  ...WALLET_ENTRY_KINDS.map(kind => ({ label: t(`wallet.movements.kinds.${kind}`), value: kind })),
])

function cambiar(cambios: Partial<WalletFilter>) {
  emit('update:filtro', { ...props.filtro, ...cambios })
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-billetera"
  >
    <UFormField
      :label="t('wallet.filters.kind')"
      class="min-w-56 flex-1"
    >
      <USelect
        :model-value="filtro.kind ?? TODOS"
        :items="tipos"
        class="w-full"
        data-test="filtro-tipo"
        @update:model-value="cambiar({ kind: $event === TODOS ? null : $event as WalletEntryKind })"
      />
    </UFormField>

    <UFormField :label="t('wallet.filters.from')">
      <UInput
        type="date"
        :model-value="filtro.desde ?? ''"
        data-test="filtro-desde"
        @update:model-value="cambiar({ desde: $event ? String($event) : null })"
      />
    </UFormField>

    <UFormField :label="t('wallet.filters.to')">
      <UInput
        type="date"
        :model-value="filtro.hasta ?? ''"
        data-test="filtro-hasta"
        @update:model-value="cambiar({ hasta: $event ? String($event) : null })"
      />
    </UFormField>

    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      :label="t('wallet.filters.clear')"
      data-test="filtro-limpiar"
      @click="emit('update:filtro', emptyWalletFilter())"
    />
  </div>
</template>
