<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { IMAGENES_DEL_MODELO, PASOS_DE_COMPRA } from '#shared/content/modelo'
import type { RolDelCamino } from '#shared/content/modelo'

/**
 * HU-41 · RF-41.2 — el camino de compra paso a paso: de Visitante a Usuario y
 * de Usuario a Propietario. Cada paso trae el rol con el que se vive.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const COLOR: Record<RolDelCamino, 'neutral' | 'primary' | 'success'> = {
  visitor: 'neutral',
  user: 'primary',
  owner: 'success',
}
</script>

<template>
  <UPageSection
    :headline="t('model.path.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('model.path.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-camino"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-start">
      <ol class="space-y-0 lg:col-span-3">
        <li
          v-for="(paso, indice) in PASOS_DE_COMPRA"
          :key="paso.id"
          class="relative flex gap-5 pb-8 last:pb-0"
          :data-test="`paso-${paso.id}`"
        >
          <div class="flex flex-col items-center">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-default font-mono text-sm text-primary">
              {{ indice + 1 }}
            </span>
            <span
              v-if="indice < PASOS_DE_COMPRA.length - 1"
              class="mt-2 w-px flex-1 bg-border"
            />
          </div>
          <div class="pt-1">
            <UBadge
              :color="COLOR[paso.rol]"
              variant="subtle"
              size="sm"
              :label="t(`model.path.roles.${paso.rol}`)"
              :data-test="`rol-${paso.id}`"
            />
            <h3 class="mt-2 font-display text-2xl font-medium text-highlighted">
              {{ t(`model.path.steps.${paso.id}.title`) }}
            </h3>
            <p class="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {{ t(`model.path.steps.${paso.id}.description`) }}
            </p>
          </div>
        </li>
      </ol>

      <figure class="overflow-hidden rounded-2xl lg:col-span-2 lg:sticky lg:top-24">
        <NuxtImg
          :src="IMAGENES_DEL_MODELO.path"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
    </div>
  </UPageSection>
</template>
