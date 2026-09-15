<script setup lang="ts">
/**
 * HU-14 · RF-14.7b · D-39 — el aviso antes de liberar una semana.
 *
 * Liberar tiene consecuencia económica y la decisión se toma informada: si el
 * Administrador renta la semana, el ingreso es de esta fracción. Cancelar a última
 * hora o dejarla caducar no da ese derecho. Decirlo aquí evita que el Propietario
 * lo descubra después en su estado de cuenta (P-09).
 */
defineProps<{
  week: number
  enviando: boolean
}>()

defineEmits<{ confirmar: [number] }>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="primary"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('calendar.weeks.releaseTitle')"
      :description="t('calendar.weeks.releaseWarning')"
      data-test="aviso-liberacion"
    />

    <div class="flex justify-end">
      <UButton
        :loading="enviando"
        :label="t('calendar.weeks.releaseConfirm')"
        data-test="confirmar-liberacion"
        @click="$emit('confirmar', week)"
      />
    </div>
  </div>
</template>
