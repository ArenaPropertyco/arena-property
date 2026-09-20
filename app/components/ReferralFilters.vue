<script setup lang="ts">
import { emptyReferralFilter, REFERRAL_STATES } from '#shared/referrals/listing'
import type { ReferralFilter, ReferralState } from '#shared/referrals/listing'

/**
 * HU-53 · RF-53.4 — filtros del listado de referidos: estado y periodo de
 * referencia, combinables. Controlado: recibe el filtro y emite el completo con
 * cada cambio; filtrar lo hace `shared/referrals/listing`.
 */
const props = defineProps<{ filtro: ReferralFilter }>()

const emit = defineEmits<{ 'update:filtro': [ReferralFilter] }>()

const { t } = useI18n()

const TODOS = '__todos__'

const estados = computed(() => [
  { label: t('referrals.list.filters.allStates'), value: TODOS },
  ...REFERRAL_STATES.map(estado => ({ label: t(`referrals.list.states.${estado}`), value: estado })),
])

function cambiar(cambios: Partial<ReferralFilter>) {
  emit('update:filtro', { ...props.filtro, ...cambios })
}

function limpiar() {
  emit('update:filtro', emptyReferralFilter())
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-referidos"
  >
    <UFormField
      :label="t('referrals.list.filters.state')"
      class="min-w-56 flex-1"
    >
      <USelect
        :model-value="filtro.stage ?? TODOS"
        :items="estados"
        class="w-full"
        data-test="filtro-estado"
        @update:model-value="cambiar({ stage: $event === TODOS ? null : $event as ReferralState })"
      />
    </UFormField>

    <UFormField :label="t('referrals.list.filters.from')">
      <UInput
        type="date"
        :model-value="filtro.desde ?? ''"
        data-test="filtro-desde"
        @update:model-value="cambiar({ desde: $event ? String($event) : null })"
      />
    </UFormField>

    <UFormField :label="t('referrals.list.filters.to')">
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
      :label="t('referrals.list.filters.clear')"
      data-test="filtro-limpiar"
      @click="limpiar"
    />
  </div>
</template>
