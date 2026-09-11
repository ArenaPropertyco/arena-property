<script setup lang="ts">
import { CONTACTO_ARENA } from '#shared/content/contacto'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * E1 · HU-41…HU-44, HU-48 — el CTA que cierra una subpágina: al registro
 * (HU-04), con WhatsApp como alternativa. El destino lo trae el manifiesto; la
 * página puede sobrescribirlo cuando lo decide por sesión (HU-48 · RF-48.4) y
 * registra el evento `cta` en analítica.
 */
const props = withDefaults(defineProps<{
  seccion: SeccionDePagina
  descriptionKey: string
  /** Sobrescribe el destino del manifiesto; la página lo decide por sesión. */
  destino?: string | null
  imagen?: string | null
}>(), { destino: null, imagen: null })

const emit = defineEmits<{ cta: [SeccionDePagina, string] }>()

const { t } = useI18n()
const localePath = useLocalePath()

const ruta = computed(() => props.destino ?? props.seccion.cta?.destino ?? '/')
</script>

<template>
  <UContainer
    class="py-16 sm:py-24"
    data-test="seccion-cta"
  >
    <UPageCTA
      :title="t(seccion.tituloKey)"
      :description="t(descriptionKey)"
      variant="soft"
      :orientation="imagen ? 'horizontal' : 'vertical'"
      :reverse="Boolean(imagen)"
      :ui="{ title: 'font-display font-medium text-3xl sm:text-5xl' }"
    >
      <template #links>
        <UButton
          v-if="seccion.cta"
          size="xl"
          :to="localePath(ruta)"
          :label="t(seccion.cta.labelKey)"
          trailing-icon="i-lucide-arrow-right"
          :data-test="`cta-${seccion.id}`"
          @click="emit('cta', seccion, ruta)"
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
        v-if="imagen"
        :src="imagen"
        :alt="t(seccion.tituloKey)"
        class="aspect-[4/3] w-full rounded-xl object-cover"
        sizes="100vw sm:50vw"
        loading="lazy"
      />
    </UPageCTA>
  </UContainer>
</template>
