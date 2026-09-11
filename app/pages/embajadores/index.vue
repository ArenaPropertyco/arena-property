<script setup lang="ts">
import type { Component } from 'vue'
import { animacionesDePagina } from '#shared/content/animacion'
import { destinoDelCtaDeEmbajadores, IMAGENES_DE_EMBAJADORES, SECCIONES_DE_EMBAJADORES } from '#shared/content/embajadores'
import type { IdDeEmbajadores } from '#shared/content/embajadores'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { seccionesOrdenadas } from '#shared/content/manifiesto'

/**
 * HU-48 · RF-48.1…RF-48.4 · D-37 — la página pública del Programa de
 * Embajadores. Orquesta: lee el tipo de comisión predeterminado (HU-52), decide
 * el destino del CTA por sesión (registro sin ella, inscripción con ella) y
 * recorre su manifiesto. Animación con AOS y analítica de CTA (RT-12).
 */
const { t } = useI18n()
const { reducirMovimiento } = useMovimientoReducido()
const { registrarCta } = useAnaliticaDeCtas()
const { sesion } = useCuenta()
const { comision } = useComisionPublica()

const COMPONENTE: Record<IdDeEmbajadores, Component> = {
  hero: resolveComponent('ContentHero') as Component,
  flow: resolveComponent('AmbassadorFlow') as Component,
  commission: resolveComponent('AmbassadorCommissionHighlight') as Component,
  terms: resolveComponent('AmbassadorTerms') as Component,
  cta: resolveComponent('ContentCta') as Component,
}

const secciones = seccionesOrdenadas(SECCIONES_DE_EMBAJADORES)
const animaciones = computed(() => animacionesDePagina(SECCIONES_DE_EMBAJADORES, { reducirMovimiento: reducirMovimiento.value }))

/** CA-48.2 · sin sesión, al registro; con sesión, a la inscripción de HU-49. */
const destino = computed(() => destinoDelCtaDeEmbajadores({ autenticado: sesion.value.autenticado }))

function propsDe(seccion: SeccionDePagina): Record<string, unknown> {
  if (seccion.id === 'hero') {
    return { imagen: IMAGENES_DE_EMBAJADORES.hero, headlineKey: 'ambassadors.hero.headline', descriptionKey: 'ambassadors.hero.description' }
  }
  if (seccion.id === 'commission') {
    return { comision: comision.value }
  }
  if (seccion.id === 'cta') {
    return {
      descriptionKey: sesion.value.autenticado ? 'ambassadors.cta.signedIn' : 'ambassadors.cta.description',
      destino: destino.value,
    }
  }
  return {}
}

useSeoMeta({
  title: t('nav.referralProgram'),
  description: t('ambassadors.hero.description'),
  ogTitle: t('ambassadors.hero.title'),
  ogDescription: t('ambassadors.hero.description'),
  ogImage: IMAGENES_DE_EMBAJADORES.hero,
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
