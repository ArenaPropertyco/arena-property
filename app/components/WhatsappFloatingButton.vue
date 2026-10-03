<script setup lang="ts">
import { MENSAJE_WHATSAPP_FLOTANTE, urlDeWhatsapp } from '#shared/content/contacto'

/**
 * HU-00 · RT-06 — el botón flotante de WhatsApp del sitio público, en oro Arena
 * del manual de marca. Va fijo abajo a la derecha y se monta solo en el layout
 * público: los paneles de los usuarios no lo llevan.
 *
 * Es solo el icono de WhatsApp: el texto («Quiero saber más sobre las propiedades
 * fraccionadas») viaja como mensaje ya escrito en el enlace y se anuncia a los
 * lectores de pantalla. Respeta `prefers-reduced-motion`: la elevación al pasar
 * el cursor se apaga sola.
 */
const { t } = useI18n()

const url = urlDeWhatsapp(MENSAJE_WHATSAPP_FLOTANTE)
</script>

<template>
  <a
    :href="url"
    target="_blank"
    rel="noopener"
    :aria-label="t('whatsappFloat.aria')"
    :title="MENSAJE_WHATSAPP_FLOTANTE"
    class="fixed bottom-4 right-4 z-40 inline-flex items-center justify-center rounded-full bg-arena-500 p-4 text-ink-950 shadow-lg ring-1 ring-arena-700/30 transition hover:bg-arena-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arena-700 motion-safe:hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
    data-test="whatsapp-flotante"
  >
    <UIcon
      name="i-simple-icons-whatsapp"
      class="size-7"
    />
  </a>
</template>
