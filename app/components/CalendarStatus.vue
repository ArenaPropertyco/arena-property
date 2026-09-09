<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'

/** HU-12 · si el calendario del año ya se publicó y cuándo. */
defineProps<{ publicadoEl: string | null }>()

const { t, locale } = useI18n()
</script>

<template>
  <UBadge
    :color="publicadoEl ? 'success' : 'neutral'"
    variant="subtle"
    :label="publicadoEl ? t('calendar.publishedAt', { date: formatearInstante(publicadoEl, locale as Idioma) }) : t('calendar.draft')"
    data-test="estado-calendario"
  />
</template>
