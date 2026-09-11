<script setup lang="ts">
import type { Component } from 'vue'
import { animacionesDePagina } from '#shared/content/animacion'
import { seccionesOrdenadas } from '#shared/content/manifiesto'
import { IMAGENES_DE_NOSOTROS, SECCIONES_DE_NOSOTROS } from '#shared/content/nosotros'
import type { IdDeNosotros } from '#shared/content/nosotros'

/**
 * HU-44 · RF-44.1…RF-44.4 — Sobre Nosotros recorre su manifiesto de cuatro
 * secciones: quiénes somos, preguntas frecuentes, testimonios e información de
 * interés con el CTA al registro. Animación con AOS y analítica (RT-12).
 */
const { t } = useI18n()
const { reducirMovimiento } = useMovimientoReducido()
const { registrarCta } = useAnaliticaDeCtas()

const COMPONENTE: Record<IdDeNosotros, Component> = {
  who_we_are: resolveComponent('AboutWhoWeAre') as Component,
  faq: resolveComponent('AboutFaq') as Component,
  testimonials: resolveComponent('AboutTestimonials') as Component,
  info: resolveComponent('AboutInfo') as Component,
}

const secciones = seccionesOrdenadas(SECCIONES_DE_NOSOTROS)
const animaciones = computed(() => animacionesDePagina(SECCIONES_DE_NOSOTROS, { reducirMovimiento: reducirMovimiento.value }))

useSeoMeta({
  title: t('nav.about'),
  description: t('about.whoWeAre.description'),
  ogTitle: t('about.whoWeAre.title'),
  ogDescription: t('about.whoWeAre.description'),
  ogImage: IMAGENES_DE_NOSOTROS.whoWeAre,
})
</script>

<template>
  <div>
    <UPageHeader
      :headline="t('app.name')"
      :title="t('nav.about')"
      :description="t('app.tagline')"
      :ui="{ title: 'font-display font-medium text-4xl sm:text-6xl' }"
      class="border-b border-default"
    />
    <component
      :is="COMPONENTE[seccion.id]"
      v-for="seccion in secciones"
      :key="seccion.id"
      :seccion="seccion"
      v-bind="animaciones[seccion.id]"
      @cta="registrarCta"
    />
  </div>
</template>
