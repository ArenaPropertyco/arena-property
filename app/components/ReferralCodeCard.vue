<script setup lang="ts">
import { referralLink, shareLinks } from '#shared/referrals/code'

/**
 * HU-50 · RF-50.2, RF-50.3, RF-50.4 — el código del Embajador y su enlace.
 *
 * El código se muestra y se copia, nunca se edita (RF-50.2): aquí no hay ningún
 * campo de entrada. El enlace y los destinos de difusión los arma el motor puro,
 * ya codificados (CA-50.3, CA-50.4).
 */
const props = defineProps<{
  code: string
  baseUrl: string
}>()

const { t } = useI18n()
const toast = useToast()

const enlace = computed(() => referralLink(props.baseUrl, props.code))
const difusion = computed(() => shareLinks(enlace.value, {
  subject: t('referrals.code.shareSubject'),
  message: t('referrals.code.shareMessage'),
}))

const REDES = [
  { clave: 'whatsapp', icono: 'i-lucide-message-circle' },
  { clave: 'email', icono: 'i-lucide-mail' },
  { clave: 'x', icono: 'i-lucide-twitter' },
  { clave: 'facebook', icono: 'i-lucide-facebook' },
] as const

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.add({ title: t(aviso), color: 'success' })
  }
  catch {
    toast.add({ title: t('referrals.code.copyFailed'), color: 'error' })
  }
}
</script>

<template>
  <div
    class="space-y-4 rounded-2xl border border-default bg-default p-4"
    data-test="tarjeta-codigo"
  >
    <div class="space-y-1">
      <p class="text-sm text-muted">
        {{ t('referrals.code.title') }}
      </p>
      <p
        class="font-mono text-2xl tracking-widest text-highlighted"
        data-test="codigo-referido"
      >
        {{ code }}
      </p>
    </div>

    <p
      class="break-all font-mono text-xs text-muted"
      data-test="enlace-referido"
    >
      {{ enlace }}
    </p>

    <div class="flex flex-wrap gap-2">
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-copy"
        :label="t('referrals.code.copyCode')"
        data-test="copiar-codigo"
        @click="copiar(code, 'referrals.code.codeCopied')"
      />
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-link"
        :label="t('referrals.code.copyLink')"
        data-test="copiar-enlace"
        @click="copiar(enlace, 'referrals.code.linkCopied')"
      />
    </div>

    <div class="flex flex-wrap gap-2 border-t border-default pt-3">
      <UButton
        v-for="red in REDES"
        :key="red.clave"
        :href="difusion[red.clave]"
        target="_blank"
        rel="noopener"
        variant="soft"
        color="neutral"
        size="sm"
        :icon="red.icono"
        :label="t(`referrals.code.share.${red.clave}`)"
        :data-test="`compartir-${red.clave}`"
      />
    </div>
  </div>
</template>
