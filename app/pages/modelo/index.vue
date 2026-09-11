<script setup lang="ts">
import type { Component } from 'vue'
import { animacionesDePagina } from '#shared/content/animacion'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { seccionesOrdenadas } from '#shared/content/manifiesto'
import { IMAGENES_DEL_MODELO, SECCIONES_DEL_MODELO } from '#shared/content/modelo'
import type { IdDelModelo } from '#shared/content/modelo'

/**
 * HU-41 · RF-41.1…RF-41.4 — la página del modelo de negocio recorre su
 * manifiesto tipado: qué se pinta, en qué orden y adónde lleva el CTA vive en
 * `shared/content/modelo`. Animación de entrada con AOS (RT-12) y cada CTA
 * activado va a analítica con su sección de origen.
 */
const { t } = useI18n()
const { reducirMovimiento } = useMovimientoReducido()
const { registrarCta } = useAnaliticaDeCtas()

const COMPONENTE: Record<IdDelModelo, Component> = {
  hero: resolveComponent('ContentHero') as Component,
  structure: resolveComponent('ModelStructure') as Component,
  what_we_do: resolveComponent('ModelWhatWeDo') as Component,
  what_we_are_not: resolveComponent('ModelWhatWeAreNot') as Component,
  path: resolveComponent('ModelPurchasePath') as Component,
  cta: resolveComponent('ContentCta') as Component,
}

const secciones = seccionesOrdenadas(SECCIONES_DEL_MODELO)
const animaciones = computed(() => animacionesDePagina(SECCIONES_DEL_MODELO, { reducirMovimiento: reducirMovimiento.value }))

function propsDe(seccion: SeccionDePagina): Record<string, unknown> {
  if (seccion.id === 'hero') {
    return { imagen: IMAGENES_DEL_MODELO.hero, headlineKey: 'model.hero.headline', descriptionKey: 'model.hero.description' }
  }
  if (seccion.id === 'cta') {
    return { descriptionKey: 'model.cta.description' }
  }
  return {}
}

useSeoMeta({
  title: t('nav.model'),
  description: t('model.hero.description'),
  ogTitle: t('model.hero.title'),
  ogDescription: t('model.hero.description'),
  ogImage: IMAGENES_DEL_MODELO.hero,
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
