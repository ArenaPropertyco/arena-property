<script setup lang="ts">
import type { NuxtError } from '#app'
import { en, es } from '@nuxt/ui/locale'

/**
 * Página de error de toda la aplicación (404 y demás códigos). Nuxt la pinta en
 * lugar de `app.vue`, así que repite `UApp` y usa el layout público: la cabecera
 * y el pie siguen ahí para orientarse. Solo orquesta; la escena es `NotFoundHero`.
 *
 * Volver al inicio limpia el error con `clearError`: navegar sin limpiarlo
 * dejaría esta página pintada sobre la ruta nueva.
 */
const props = defineProps<{ error: NuxtError }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { reducirMovimiento } = useMovimientoReducido()

const idiomas = { es, en }
const idiomaDeUi = computed(() => idiomas[locale.value as 'es' | 'en'] ?? es)

const codigo = computed(() => props.error?.statusCode ?? 500)

useSeoMeta({
  title: () => codigo.value === 404 ? t('errorPage.notFound.title') : t('errorPage.generic.title'),
  robots: 'noindex, nofollow',
})

function volverAlInicio() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <UApp :locale="idiomaDeUi">
    <NuxtLayout name="default">
      <NotFoundHero
        :codigo="codigo"
        :modelo="localePath('/modelo')"
        :reducir-movimiento="reducirMovimiento"
        @inicio="volverAlInicio"
      />
    </NuxtLayout>
  </UApp>
</template>
