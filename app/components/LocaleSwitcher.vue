<script setup lang="ts">
// RT-05 · cambio de idioma. Los nombres visibles salen del diccionario, no del código.
// `availableLocales` es API estándar de vue-i18n: evita atar el componente al módulo.
//
// `switchLocalePath` ya devuelve la ruta resuelta para el idioma destino, así que los
// enlaces llevan `:locale="false"`: sin eso, `UButton` la localiza otra vez contra el
// idioma actual y, como el idioma por defecto no lleva prefijo, `/panel` se convertía
// en `/en/panel` y el botón «ES» devolvía a la misma página en inglés.
const { locale, availableLocales, t } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const opciones = computed(() =>
  availableLocales.map(codigo => ({
    codigo,
    etiqueta: t(`locale.${codigo}`),
    ruta: switchLocalePath(codigo),
  })),
)
</script>

<template>
  <div
    data-test="selector-idioma"
    class="flex items-center gap-1"
    role="group"
    :aria-label="t('locale.switch')"
  >
    <UButton
      v-for="opcion in opciones"
      :key="opcion.codigo"
      :to="opcion.ruta"
      :locale="false"
      size="xs"
      color="neutral"
      :variant="opcion.codigo === locale ? 'soft' : 'ghost'"
      :aria-current="opcion.codigo === locale ? 'true' : undefined"
    >
      {{ opcion.codigo.toUpperCase() }}
      <span class="sr-only">{{ opcion.etiqueta }}</span>
    </UButton>
  </div>
</template>
