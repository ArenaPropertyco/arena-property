<script setup lang="ts">
import { formatearImporte, formatearPorcentaje } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import type { CommissionType } from '#shared/referrals/commission'

/**
 * HU-52 · RF-52.2, RF-52.3 · CA-52.5 — el catálogo de tipos de comisión, con su
 * valor, cuál es el predeterminado y cuáles están retirados.
 *
 * El valor no se edita (CA-52.4): las únicas acciones son nombrar predeterminado
 * y dejar de ofrecer un tipo, que no se lo retira a quien ya lo tenía.
 */
defineProps<{
  types: CommissionType[]
  ocupadoId: string | null
}>()

const emit = defineEmits<{
  predeterminado: [string]
  activar: [string, boolean]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function valor(type: CommissionType): string {
  return type.kind === 'fixed'
    ? formatearImporte((type.amount ?? 0) as CopAmount, idioma.value)
    : formatearPorcentaje(type.basisPoints ?? 0, idioma.value)
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="catalogo-comision"
  >
    <p
      v-if="types.length === 0"
      class="text-sm text-muted"
      data-test="sin-tipos"
    >
      {{ t('referrals.commission.empty') }}
    </p>

    <ul
      v-else
      class="divide-y divide-default rounded-2xl border border-default bg-default"
    >
      <li
        v-for="type in types"
        :key="type.id"
        class="flex flex-wrap items-center gap-3 px-3 py-2"
        :data-test="`tipo-${type.id}`"
      >
        <span class="text-sm text-highlighted">{{ type.name }}</span>
        <span
          class="font-mono text-sm text-muted"
          :data-test="`valor-${type.id}`"
        >{{ valor(type) }}</span>

        <UBadge
          v-if="type.isDefault"
          color="success"
          variant="subtle"
          size="sm"
          :label="t('referrals.commission.default')"
          :data-test="`predeterminado-${type.id}`"
        />
        <UBadge
          v-else-if="!type.active"
          color="neutral"
          variant="subtle"
          size="sm"
          :label="t('referrals.commission.inactive')"
          :data-test="`inactivo-${type.id}`"
        />

        <div class="ml-auto flex flex-wrap gap-2">
          <UButton
            v-if="!type.isDefault && type.active"
            variant="outline"
            size="sm"
            icon="i-lucide-star"
            :loading="ocupadoId === type.id"
            :label="t('referrals.commission.makeDefaultAction')"
            :data-test="`marcar-${type.id}`"
            @click="emit('predeterminado', type.id)"
          />
          <UButton
            v-if="!type.isDefault"
            variant="ghost"
            size="sm"
            :icon="type.active ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            :loading="ocupadoId === type.id"
            :label="type.active ? t('referrals.commission.deactivate') : t('referrals.commission.activate')"
            :data-test="`activar-${type.id}`"
            @click="emit('activar', type.id, !type.active)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
