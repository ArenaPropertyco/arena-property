<script setup lang="ts">
import { en, es } from '@nuxt/ui/locale'

// `UApp` es obligatorio en Nuxt UI: provee toasts, tooltips y overlays, y recibe el
// idioma activo para los textos internos de sus componentes.
const { locale } = useI18n()
const idiomas = { es, en }
const idiomaDeUi = computed(() => idiomas[locale.value as 'es' | 'en'] ?? es)

// HU-51 · RF-51.1 · D-03 · un visitante que llega por un enlace de referido deja
// constancia del clic en el servidor: de ahí sale la ventana de 90 días, y no de
// una fecha que el cliente pueda escribir al registrarse.
const { registrarClic } = useCodigoDeReferido()
onMounted(() => {
  registrarClic()
})
</script>

<template>
  <UApp :locale="idiomaDeUi">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
