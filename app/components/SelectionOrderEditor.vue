<script setup lang="ts">
/**
 * HU-12 · RF-12.4, RF-12.5 · D-32 — el orden de turnos del año, editable antes de
 * abrir la selección. Controlado: recibe el orden y emite el nuevo con cada
 * movimiento; «Sugerir» pide a la página el orden que propone la base (CA-12.6).
 */
defineProps<{
  order: number[]
  fractions: { number: number, ownerName: string | null }[]
  editable: boolean
}>()

const emit = defineEmits<{
  'update:order': [number[]]
  'sugerir': []
}>()

const { t } = useI18n()

function move(order: number[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= order.length) {
    return
  }
  const next = [...order]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  emit('update:order', next)
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="orden-de-turnos"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted">
        {{ t('calendar.selection.orderHint') }}
      </p>
      <UButton
        v-if="editable"
        variant="outline"
        size="sm"
        icon="i-lucide-sparkles"
        :label="t('calendar.selection.suggest')"
        data-test="sugerir-orden"
        @click="emit('sugerir')"
      />
    </div>

    <p
      v-if="order.length === 0"
      class="text-sm text-muted"
      data-test="sin-titulares"
    >
      {{ t('calendar.selection.noOwners') }}
    </p>

    <ol
      v-else
      class="divide-y divide-default rounded-2xl border border-default bg-default"
    >
      <li
        v-for="(fraction, index) in order"
        :key="fraction"
        class="flex items-center gap-3 px-3 py-2"
        :data-test="`turno-${fraction}`"
      >
        <span class="w-6 font-mono text-sm text-muted">{{ index + 1 }}</span>
        <span class="font-mono text-sm text-highlighted">{{ t('calendar.fractionLabel', { n: fraction }) }}</span>
        <span class="flex-1 truncate text-sm text-muted">{{ fractions.find(f => f.number === fraction)?.ownerName ?? '' }}</span>
        <template v-if="editable">
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-chevron-up"
            :aria-label="t('calendar.selection.up')"
            :disabled="index === 0"
            :data-test="`subir-${fraction}`"
            @click="move(order, index, -1)"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-chevron-down"
            :aria-label="t('calendar.selection.down')"
            :disabled="index === order.length - 1"
            :data-test="`bajar-${fraction}`"
            @click="move(order, index, 1)"
          />
        </template>
      </li>
    </ol>
  </div>
</template>
