<script setup lang="ts">
/**
 * Aviso sobre el código de referido escrito en el registro (HU-04 · RF-04.4):
 * se registrará, o su formato no sirve y el registro sigue sin él.
 */
defineProps<{
  codigo: string | null
  valido: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <UAlert
    v-if="codigo && valido"
    color="success"
    variant="subtle"
    icon="i-lucide-ticket"
    :title="t('auth.register.referralApplied', { code: codigo })"
    data-test="aviso-referido"
  />
  <UAlert
    v-else-if="codigo"
    color="neutral"
    variant="subtle"
    icon="i-lucide-info"
    :title="t('auth.register.referralIgnored')"
    data-test="aviso-referido"
  />
</template>
