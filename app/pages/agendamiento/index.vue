<script setup lang="ts">
import type { Component } from 'vue'
import { IMAGENES_DE_AGENDAMIENTO, SECCIONES_DE_AGENDAMIENTO } from '#shared/content/agendamiento'
import type { IdDeAgendamiento } from '#shared/content/agendamiento'
import { animacionesDePagina } from '#shared/content/animacion'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { seccionesOrdenadas } from '#shared/content/manifiesto'

/**
 * HU-43 · RF-43.1…RF-43.4 · D-33 — la página del sistema de agendamiento
 * recorre su manifiesto: la tabla de temporadas se deriva del criterio de HU-12,
 * así que no puede prometer nada distinto al motor. Animación con AOS y
 * analítica de CTA (RT-12).
 */
const { t } = useI18n()
const { reducirMovimiento } = useMovimientoReducido()
const { registrarCta } = useAnaliticaDeCtas()

const COMPONENTE: Record<IdDeAgendamiento, Component> = {
  hero: resolveComponent('ContentHero') as Component,
  seasons: resolveComponent('SchedulingSeasons') as Component,
  rules: resolveComponent('SchedulingRules') as Component,
  cta: resolveComponent('ContentCta') as Component,
}

const secciones = seccionesOrdenadas(SECCIONES_DE_AGENDAMIENTO)
const animaciones = computed(() => animacionesDePagina(SECCIONES_DE_AGENDAMIENTO, { reducirMovimiento: reducirMovimiento.value }))

function propsDe(seccion: SeccionDePagina): Record<string, unknown> {
  if (seccion.id === 'hero') {
    return { imagen: IMAGENES_DE_AGENDAMIENTO.hero, headlineKey: 'scheduling.hero.headline', descriptionKey: 'scheduling.hero.description' }
  }
  if (seccion.id === 'cta') {
    return { descriptionKey: 'scheduling.cta.description' }
  }
  return {}
}

useSeoMeta({
  title: t('nav.scheduling'),
  description: t('scheduling.hero.description'),
  ogTitle: t('scheduling.hero.title'),
  ogDescription: t('scheduling.hero.description'),
  ogImage: IMAGENES_DE_AGENDAMIENTO.hero,
})
</script>

<template>
  <div>
    <component
      :is="COMPONENTE[seccion.id]"
      v-for="seccion in secciones"
      :key="seccion.id"
      :seccion="seccion"
      v-bind="{ ...animaciones[seccion.id], ...propsDe(seccion) }"
      @cta="registrarCta"
    />
  </div>
</template>
