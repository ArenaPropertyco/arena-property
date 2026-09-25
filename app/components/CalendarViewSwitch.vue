<script setup lang="ts">
/**
 * RT-06 · el interruptor entre las dos vistas del calendario: lista vertical por
 * semanas (apagado) o almanaque de doce meses (encendido). Los iconos a cada lado
 * dicen qué hay en cada posición sin leer; el texto queda para el lector de pantalla.
 */
const almanaque = defineModel<boolean>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div
    class="inline-flex items-center gap-2"
    data-test="vista-calendario"
  >
    <UIcon
      name="i-lucide-list"
      class="size-4"
      :class="almanaque ? 'text-dimmed' : 'text-highlighted'"
      :title="t('calendar.view.list')"
      data-test="vista-lista"
    />
    <USwitch
      v-model="almanaque"
      unchecked-icon="i-lucide-list"
      checked-icon="i-lucide-calendar-days"
      :aria-label="t('calendar.view.label')"
      :ui="{ wrapper: 'sr-only' }"
      :label="almanaque ? t('calendar.view.almanac') : t('calendar.view.list')"
      data-test="cambiar-vista"
    />
    <UIcon
      name="i-lucide-calendar-days"
      class="size-4"
      :class="almanaque ? 'text-highlighted' : 'text-dimmed'"
      :title="t('calendar.view.almanac')"
      data-test="vista-almanaque"
    />
  </div>
</template>
