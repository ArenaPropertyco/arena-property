<script setup lang="ts">
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * E1 · marcador de posición de una subpágina institucional que llega en el Sprint 2
 * (HU-41…HU-44). La spec de HU-00 autoriza rutas placeholder en el mismo sprint
 * para que los CTA de la home resuelvan a rutas reales (CA-00.2).
 */
defineProps<{
  titulo: string
  descripcion: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <UPageHero
    :title="titulo"
    :description="descripcion"
    :ui="{ title: 'font-display font-medium' }"
    data-test="marcador-publico"
  >
    <template #links>
      <UButton
        size="lg"
        :to="localePath(RUTAS_PUBLICAS.registro)"
        :label="t('placeholder.cta')"
        trailing-icon="i-lucide-arrow-right"
      />
      <UButton
        size="lg"
        variant="ghost"
        color="neutral"
        :to="localePath(RUTAS_PUBLICAS.catalogo)"
        :label="t('nav.catalog')"
      />
    </template>
  </UPageHero>
</template>
