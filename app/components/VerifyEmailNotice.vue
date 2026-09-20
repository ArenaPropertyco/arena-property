<script setup lang="ts">
/**
 * Aviso de «revisa tu correo» (HU-04 · RF-04.2). El reenvío es un evento: la
 * página lo lleva a Supabase y decide cómo confirmarlo.
 */
withDefaults(defineProps<{
  email?: string | null
  reenviando?: boolean
  /** Bandeja de pruebas del stack local, cuando la app corre contra él. */
  bandejaLocal?: string | null
}>(), {
  email: null,
  reenviando: false,
  bandejaLocal: null,
})

defineEmits<{ reenviar: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-6">
    <p
      class="text-default"
      data-test="mensaje-verificacion"
    >
      {{ email ? t('auth.verify.body', { email }) : t('auth.verify.bodyGeneric') }}
    </p>

    <UAlert
      v-if="bandejaLocal"
      color="warning"
      variant="subtle"
      icon="i-lucide-flask-conical"
      :title="t('auth.verify.localInbox')"
      data-test="bandeja-local"
    >
      <template #description>
        <a
          :href="bandejaLocal"
          target="_blank"
          rel="noopener"
          class="underline"
        >{{ bandejaLocal }}</a>
      </template>
    </UAlert>

    <UButton
      v-if="email"
      color="neutral"
      variant="outline"
      :loading="reenviando"
      :label="t('auth.verify.resend')"
      @click="$emit('reenviar')"
    />
  </div>
</template>
