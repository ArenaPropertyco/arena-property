<script setup lang="ts">
import type { ComisionPublicada } from '#shared/content/embajadores'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-48 · RF-48.2 · CA-48.1 — el monto vigente de la comisión, tal como lo
 * configuró el Superadmin (HU-52, D-37), en IBM Plex Mono. Recibe la cifra ya
 * formateada por TR-02; sin tipo predeterminado lo dice, no inventa un valor.
 */
defineProps<{
  seccion: SeccionDePagina
  comision: ComisionPublicada | null
}>()

const { t } = useI18n()
</script>

<template>
  <UPageSection
    :headline="t('ambassadors.commission.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('ambassadors.commission.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-comision"
  >
    <div class="mx-auto max-w-2xl rounded-3xl border border-primary/30 bg-default p-8 text-center sm:p-12">
      <template v-if="comision">
        <p class="text-xs uppercase tracking-[0.25em] text-muted">
          {{ comision.name }}
        </p>
        <p
          class="mt-3 font-mono text-5xl text-primary sm:text-7xl"
          data-test="comision-vigente"
        >
          {{ comision.texto }}
        </p>
        <p
          class="mt-4 text-sm text-muted"
          data-test="comision-nota"
        >
          {{ comision.kind === 'percentage' ? t('ambassadors.commission.percentageHint') : t('ambassadors.commission.fixedHint') }}
        </p>
      </template>
      <p
        v-else
        class="text-base text-muted"
        data-test="comision-no-disponible"
      >
        {{ t('ambassadors.commission.unavailable') }}
      </p>
    </div>
  </UPageSection>
</template>
