<script setup lang="ts">
import type { SolicitudDeContacto } from '#shared/contact/esquema'
import { CONTACTO_ARENA } from '#shared/content/contacto'

/**
 * HU-46 · RF-46.1…RF-46.6 — formulario general de contacto. La página orquesta:
 * prellena el código de referido de la sesión, envía por la ruta Nitro y avisa.
 */
const { t } = useI18n()
const toast = useToast()
const { codigo } = useCodigoDeReferido()
const { enviar } = useContacto()

const enviando = ref(false)
const enviado = ref(false)

useSeoMeta({
  title: t('contact.title'),
  description: t('contact.seoDescription'),
})

async function enviarContacto(solicitud: SolicitudDeContacto) {
  enviando.value = true
  const resultado = await enviar(solicitud, 'general')
  enviando.value = false

  toast.add(resultado.ok
    ? { title: resultado.correoEnviado === false ? t('contact.sentNoEmail') : t('contact.sent'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  enviado.value = resultado.ok
}
</script>

<template>
  <div>
    <UPageHeader
      :headline="t('app.name')"
      :title="t('contact.title')"
      :description="t('contact.subtitle')"
      :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl' }"
      class="border-b border-default"
    >
      <template #links>
        <UButton
          variant="outline"
          icon="i-lucide-message-circle"
          :to="CONTACTO_ARENA.whatsappUrl"
          target="_blank"
          rel="noopener"
          :label="t('contact.whatsapp')"
        />
      </template>
    </UPageHeader>

    <UContainer class="max-w-3xl py-10 sm:py-14">
      <p
        v-if="enviado"
        class="rounded-2xl border border-success/30 bg-success/5 px-6 py-10 text-center text-success"
        data-test="contacto-enviado"
      >
        {{ t('contact.sent') }}
      </p>
      <ContactForm
        v-else
        :codigo-referido="codigo"
        :enviando="enviando"
        @submit="enviarContacto"
      />
    </UContainer>
  </div>
</template>
