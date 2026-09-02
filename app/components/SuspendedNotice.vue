<script setup lang="ts">
/** Aviso de cuenta suspendida (HU-33 · RF-33.1). Cerrar sesión es un evento. */
defineEmits<{ salir: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-6">
    <p class="text-default">
      {{ t('auth.suspended.body') }}
    </p>

    <UButton
      color="neutral"
      variant="outline"
      :label="t('actions.logout')"
      @click="$emit('salir')"
    />
  </div>
</template>
