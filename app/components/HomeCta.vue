<script setup lang="ts">
import { CONTACTO_ARENA } from '#shared/content/contacto'
import type { SeccionDeLaHome } from '#shared/content/home'
import { IMAGENES_DE_LA_HOME } from '#shared/content/home'

/**
 * HU-00 · RF-00.5 — el CTA principal: al registro (HU-04), con WhatsApp como
 * alternativa para quien prefiere conversar, como en el sitio oficial.
 */
defineProps<{ seccion: SeccionDeLaHome }>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <UContainer
    class="py-16 sm:py-24"
    data-test="seccion-cta"
  >
    <UPageCTA
      :title="t(seccion.tituloKey)"
      :description="t('home.cta.description')"
      variant="soft"
      orientation="horizontal"
      reverse
      :ui="{ title: 'font-display font-medium text-3xl sm:text-5xl' }"
    >
      <template #links>
        <UButton
          v-if="seccion.cta"
          size="xl"
          :to="localePath(seccion.cta.destino)"
          :label="t(seccion.cta.labelKey)"
          trailing-icon="i-lucide-arrow-right"
          :data-test="`cta-${seccion.id}`"
          @click="emit('cta', seccion)"
        />
        <UButton
          size="xl"
          variant="ghost"
          color="neutral"
          icon="i-lucide-message-circle"
          :to="CONTACTO_ARENA.whatsappUrl"
          target="_blank"
          rel="noopener"
          :label="t('home.cta.secondary')"
        />
      </template>

      <NuxtImg
        :src="IMAGENES_DE_LA_HOME.cta"
        :alt="t(seccion.tituloKey)"
        class="aspect-[4/3] w-full rounded-xl object-cover"
        sizes="100vw sm:50vw"
        loading="lazy"
      />
    </UPageCTA>
  </UContainer>
</template>
