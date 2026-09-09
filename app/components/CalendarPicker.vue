<script setup lang="ts">
import type { OpcionDeCuenta } from '#shared/properties/vistas'

/**
 * HU-12 · qué propiedad y qué año se configuran. Controlado: emite los cambios.
 */
defineProps<{
  propiedades: OpcionDeCuenta[]
  propertyId: string | null
  anio: number
}>()

const emit = defineEmits<{
  'update:propertyId': [string | null]
  'update:anio': [number]
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="selector-calendario"
  >
    <UFormField
      :label="t('calendar.property')"
      class="min-w-64 flex-1"
    >
      <USelect
        :model-value="propertyId ?? undefined"
        :items="propiedades.map(p => ({ label: p.label, value: p.id }))"
        class="w-full"
        data-test="selector-propiedad"
        @update:model-value="emit('update:propertyId', $event ? String($event) : null)"
      />
    </UFormField>

    <UFormField :label="t('calendar.year')">
      <div class="flex items-center gap-2">
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-left"
          :aria-label="t('calendar.previousYear')"
          data-test="anio-anterior"
          @click="emit('update:anio', anio - 1)"
        />
        <span
          class="min-w-16 text-center font-mono text-lg"
          data-test="anio-actual"
        >{{ anio }}</span>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-right"
          :aria-label="t('calendar.nextYear')"
          data-test="anio-siguiente"
          @click="emit('update:anio', anio + 1)"
        />
      </div>
    </UFormField>
  </div>
</template>
