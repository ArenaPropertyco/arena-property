<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * Layout público del sitio institucional (E1). Solo estructura: cabecera, contenido
 * y pie son componentes; aquí se decide qué entradas lleva la navegación.
 * RT-06 · responsive de 320px en adelante y bitema desde el primer commit.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const inicio = computed(() => localePath('/'))

const enlaces = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.home'), to: localePath('/') },
  { label: t('nav.catalog'), to: localePath('/propiedades') },
  { label: t('nav.model'), to: localePath('/modelo') },
  { label: t('nav.benefits'), to: localePath('/beneficios') },
  { label: t('nav.scheduling'), to: localePath('/agendamiento') },
  { label: t('nav.about'), to: localePath('/nosotros') },
  { label: t('nav.contact'), to: localePath('/contacto') },
])
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default text-default">
    <PublicHeader
      :items="enlaces"
      :inicio="inicio"
    />

    <UMain class="flex-1">
      <slot />
    </UMain>

    <PublicFooter
      :inicio="inicio"
      :items="enlaces"
    />
  </div>
</template>
