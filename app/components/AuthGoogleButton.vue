<script setup lang="ts">
/**
 * HU-61 · RF-61.1 — entrar o registrarse con Google. Solo presenta el control y
 * emite la intención; la página decide cuándo llamar al proveedor y adónde ir.
 */
withDefaults(defineProps<{
  cargando?: boolean
}>(), {
  cargando: false,
})

const emit = defineEmits<{ continuar: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3 text-xs text-muted">
      <span class="h-px flex-1 bg-default" />
      {{ t('auth.google.divider') }}
      <span class="h-px flex-1 bg-default" />
    </div>

    <UButton
      type="button"
      color="neutral"
      variant="outline"
      block
      icon="i-logos-google-icon"
      :label="t('auth.google.continue')"
      :loading="cargando"
      data-test="boton-google"
      @click="emit('continuar')"
    />
  </div>
</template>
