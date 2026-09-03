<script setup lang="ts">
import iconoColor from '~/assets/brand/icono-color.svg'
import logotipoColor from '~/assets/brand/logotipo-color.svg'

/**
 * Marca enlazada al inicio (RT-07). Se usa la variante a color del manual en
 * los dos temas: el logotipo es el mismo en claro y en oscuro, para que la marca
 * no cambie de aspecto con el tema. La variante blanca queda en `assets/brand`
 * por si un fondo oscuro de marketing la necesita, pero la interfaz no la pinta.
 *
 * El tamaño lo manda el hueco, no el archivo: la altura es un techo y el ancho
 * se ajusta a lo que haya. Así el logotipo se encoge con la barra lateral del
 * panel —que es redimensionable— en vez de desbordarla o recortarse.
 *
 * `solo-icono` deja el isotipo, que es lo que cabe en la barra lateral plegada.
 */
withDefaults(defineProps<{
  to: string
  soloIcono?: boolean
}>(), {
  soloIcono: false,
})

const { t } = useI18n()

// El enlace nombra a la marca; la imagen es decorativa para no repetirlo.
const decorativa = { 'alt': '', 'aria-hidden': true } as const
</script>

<template>
  <NuxtLink
    :to="to"
    :aria-label="t('app.name')"
    class="flex min-w-0 items-center"
    :class="soloIcono ? 'shrink-0' : 'w-full'"
    data-test="marca"
  >
    <!--
      `object-contain` con `object-left` deja que la caja se estreche sin
      deformar ni recortar: el logotipo se reescala dentro y queda alineado.
    -->
    <img
      v-if="soloIcono"
      v-bind="decorativa"
      :src="iconoColor"
      class="size-8 max-w-full shrink-0 object-contain"
    >
    <img
      v-else
      v-bind="decorativa"
      :src="logotipoColor"
      class="h-auto max-h-8 w-full max-w-36 object-contain object-left sm:max-h-9"
    >
  </NuxtLink>
</template>
