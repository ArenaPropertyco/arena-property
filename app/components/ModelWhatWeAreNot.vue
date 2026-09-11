<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { LO_QUE_NO_SOMOS } from '#shared/content/modelo'

/**
 * HU-41 · RF-41.1 — lo que el modelo no es. Decirlo claro es parte de la
 * honestidad con la que se presenta el producto (principio 9).
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()
</script>

<template>
  <UPageSection
    :title="t(seccion.tituloKey)"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl' }"
    data-test="seccion-que-no-es"
  >
    <ul class="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
      <li
        v-for="item in LO_QUE_NO_SOMOS"
        :key="item"
        class="flex gap-4 rounded-2xl border border-default p-5"
        data-test="no-es"
      >
        <UIcon
          name="i-lucide-x-circle"
          class="mt-0.5 size-5 shrink-0 text-error"
        />
        <div>
          <h3 class="font-display text-xl font-medium text-highlighted">
            {{ t(`model.whatWeAreNot.items.${item}.title`) }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{ t(`model.whatWeAreNot.items.${item}.description`) }}
          </p>
        </div>
      </li>
    </ul>
  </UPageSection>
</template>
