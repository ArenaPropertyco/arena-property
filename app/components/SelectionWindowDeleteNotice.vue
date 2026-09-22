<script setup lang="ts">
import type { WindowPhase } from '#shared/scheduling/relocation'

/**
 * HU-59 · RF-59.10 · D-48 — el aviso antes de eliminar la ventana de reubicación.
 *
 * Eliminar no deshace nada: las semanas que ya se movieron se quedan en su fecha
 * nueva (principio 9). Lo que desaparece es el marco —los turnos y la franja por
 * orden de llegada—, así que nadie vuelve a reubicar hasta que se configure otra.
 * Con la ventana abierta hay gente operando ahora mismo, y eso se dice aparte.
 */
defineProps<{
  anio: number
  phase: WindowPhase
  /** Cuántos titulares tienen turno y recibirán el aviso. */
  turnos: number
  enviando: boolean
}>()

defineEmits<{ confirmar: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('calendar.relocation.deleteTitle', { year: anio })"
      :description="t('calendar.relocation.deleteWarning')"
      data-test="aviso-eliminar-ventana"
    />

    <p
      v-if="phase === 'turns' || phase === 'open'"
      class="text-sm text-error"
      data-test="ventana-en-curso"
    >
      {{ t('calendar.relocation.deleteWhileOpen') }}
    </p>

    <p
      v-if="turnos > 0"
      class="text-sm text-muted"
      data-test="avisados-eliminar"
    >
      {{ t('calendar.relocation.deleteNotifies', { count: turnos }) }}
    </p>

    <div class="flex justify-end">
      <UButton
        color="error"
        icon="i-lucide-trash-2"
        :loading="enviando"
        :label="t('calendar.relocation.deleteConfirm')"
        data-test="confirmar-eliminar-ventana"
        @click="$emit('confirmar')"
      />
    </div>
  </div>
</template>
