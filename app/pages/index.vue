<script setup lang="ts">
import type { Component } from 'vue'
import { animacionesDeLaHome } from '#shared/content/animacion'
import { PROPIEDADES_EN_LA_HOME, SECCIONES_DE_LA_HOME, seccionesDeContenido } from '#shared/content/home'
import type { IdDeSeccion, SeccionDeLaHome } from '#shared/content/home'

/**
 * HU-00 · RF-00.1, RF-00.2 — la home recorre el manifiesto tipado y no fija
 * secciones en el marcado: qué se pinta, en qué orden y adónde lleva cada CTA
 * vive en `shared/content/home`. La cabecera y el pie los pone el layout. Las
 * propiedades activas se consultan aquí (solo lo publicado, por RLS) y se pasan a
 * su sección como props.
 *
 * RF-00.7 · la animación de entrada sale de una función pura y se apaga con
 * `prefers-reduced-motion`. RF-00.8 · cada CTA activado va a `nuxt-gtag` con su
 * sección de origen.
 */
const { t } = useI18n()
const { reducirMovimiento } = useMovimientoReducido()
const { registrarCta } = useAnaliticaDeCtas()
const { propiedades } = useCatalogo()

const COMPONENTE: Partial<Record<IdDeSeccion, Component>> = {
  hero: resolveComponent('HomeHero') as Component,
  business_model: resolveComponent('HomeBusinessModel') as Component,
  benefits: resolveComponent('HomeBenefits') as Component,
  properties: resolveComponent('HomeProperties') as Component,
  cta: resolveComponent('HomeCta') as Component,
}

const secciones = seccionesDeContenido(SECCIONES_DE_LA_HOME)
const animaciones = computed(() => animacionesDeLaHome(SECCIONES_DE_LA_HOME, { reducirMovimiento: reducirMovimiento.value }))

/** Las activas para la home: publicadas y a la venta primero, hasta el tope. */
const activas = computed(() => [...propiedades.value]
  .sort((a, b) => Number(b.commercial === 'fractions_available') - Number(a.commercial === 'fractions_available'))
  .slice(0, PROPIEDADES_EN_LA_HOME))

/** Lo que cada sección necesita además del manifiesto. */
function propsDe(seccion: SeccionDeLaHome): Record<string, unknown> {
  if (seccion.id === 'hero') {
    return { reducirMovimiento: reducirMovimiento.value }
  }
  if (seccion.id === 'properties') {
    return { propiedades: activas.value }
  }
  return {}
}

useSeoMeta({
  title: t('app.name'),
  description: t('home.hero.description'),
  ogTitle: t('home.hero.title'),
  ogDescription: t('home.hero.description'),
  ogImage: '/media/hero-poster.jpg',
  ogImageWidth: 1280,
  ogImageHeight: 719,
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
