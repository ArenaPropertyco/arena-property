<script setup lang="ts">
import type { Component } from 'vue'
import { animacionesDePagina } from '#shared/content/animacion'
import { IMAGENES_DE_BENEFICIOS, SECCIONES_DE_BENEFICIOS } from '#shared/content/beneficios'
import type { IdDeBeneficios } from '#shared/content/beneficios'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { seccionesOrdenadas } from '#shared/content/manifiesto'

/**
 * HU-42 · RF-42.1…RF-42.4 — la página de beneficios recorre su manifiesto: el
 * comparativo viene de una estructura tipada con la condición de cada cifra, y
 * el CTA lleva al registro. Animación con AOS y analítica de CTA (RT-12).
 */
const { t } = useI18n()
const { reducirMovimiento } = useMovimientoReducido()
const { registrarCta } = useAnaliticaDeCtas()

const COMPONENTE: Record<IdDeBeneficios, Component> = {
  hero: resolveComponent('ContentHero') as Component,
  comparison: resolveComponent('BenefitsComparison') as Component,
  benefits: resolveComponent('BenefitsList') as Component,
  cta: resolveComponent('ContentCta') as Component,
}

const secciones = seccionesOrdenadas(SECCIONES_DE_BENEFICIOS)
const animaciones = computed(() => animacionesDePagina(SECCIONES_DE_BENEFICIOS, { reducirMovimiento: reducirMovimiento.value }))

function propsDe(seccion: SeccionDePagina): Record<string, unknown> {
  if (seccion.id === 'hero') {
    return { imagen: IMAGENES_DE_BENEFICIOS.hero, headlineKey: 'benefits.hero.headline', descriptionKey: 'benefits.hero.description' }
  }
  if (seccion.id === 'cta') {
    return { descriptionKey: 'benefits.cta.description' }
  }
  return {}
}

useSeoMeta({
  title: t('nav.benefits'),
  description: t('benefits.hero.description'),
  ogTitle: t('benefits.hero.title'),
  ogDescription: t('benefits.hero.description'),
  ogImage: IMAGENES_DE_BENEFICIOS.hero,
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
