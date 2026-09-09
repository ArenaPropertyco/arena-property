<script setup lang="ts">
/**
 * HU-14 · RF-14.9 · D-33 — cuántas semanas propias faltan por confirmar y cuándo
 * vence la más próxima. Es información, no un bloqueo: la más próxima que no se
 * confirme pasa a la bolsa de renta (RF-14.7).
 */
defineProps<{
  pending: { week: number, deadline: string }[]
  nextDeadline: string
}>()

const { t } = useI18n()
</script>

<template>
  <UAlert
    v-if="pending.length > 0"
    color="warning"
    variant="subtle"
    icon="i-lucide-hourglass"
    :title="t('calendar.weeks.pendingTitle')"
    :description="t('calendar.weeks.pendingHint', { count: pending.length, date: nextDeadline })"
    data-test="semanas-pendientes"
  />
  <UAlert
    v-else
    color="success"
    variant="subtle"
    icon="i-lucide-check-circle"
    :description="t('calendar.weeks.allConfirmed')"
    data-test="todo-confirmado"
  />
</template>
