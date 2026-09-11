<script setup lang="ts">
import { FRENTES_DE_ARENA, IMAGENES_DE_LA_HOME } from '#shared/content/home'
import type { FrenteDeArena, SeccionDeLaHome } from '#shared/content/home'

/**
 * HU-00 · RF-00.10 · D-38 — «¿Qué hace Arena Property?»: estructura,
 * comercializa y administra, y entra como un socio más. Botón a Sobre Nosotros.
 */
defineProps<{ seccion: SeccionDeLaHome }>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()

const ICONO: Record<FrenteDeArena, string> = {
  structure: 'i-lucide-drafting-compass',
  commercialize: 'i-lucide-handshake',
  manage: 'i-lucide-concierge-bell',
}
</script>

<template>
  <UPageSection
    :headline="t('home.whatWeDo.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('home.whatWeDo.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-que-hace"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-start">
      <figure class="group overflow-hidden rounded-2xl lg:col-span-2 lg:sticky lg:top-24">
        <NuxtImg
          :src="IMAGENES_DE_LA_HOME.whatWeDo"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/3] w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>

      <div class="space-y-6 lg:col-span-3">
        <ol class="grid gap-4">
          <li
            v-for="(frente, indice) in FRENTES_DE_ARENA"
            :key="frente"
            class="group flex gap-5 rounded-2xl border border-default bg-default p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            data-test="frente-home"
          >
            <div class="flex flex-col items-center gap-2">
              <span class="font-mono text-xs text-muted">0{{ indice + 1 }}</span>
              <UIcon
                :name="ICONO[frente]"
                class="size-6 text-primary transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <div>
              <h3 class="font-display text-2xl font-medium text-highlighted">
                {{ t(`home.whatWeDo.items.${frente}.title`) }}
              </h3>
              <p class="mt-1 text-sm leading-relaxed text-muted">
                {{ t(`home.whatWeDo.items.${frente}.description`) }}
              </p>
            </div>
          </li>
        </ol>

        <p class="border-l-2 border-primary pl-4 text-base leading-relaxed text-default">
          {{ t('home.whatWeDo.partner') }}
        </p>

        <div v-if="seccion.cta">
          <UButton
            size="lg"
            variant="outline"
            :to="localePath(seccion.cta.destino)"
            :label="t(seccion.cta.labelKey)"
            trailing-icon="i-lucide-arrow-right"
            :data-test="`cta-${seccion.id}`"
            @click="emit('cta', seccion)"
          />
        </div>
      </div>
    </div>
  </UPageSection>
</template>
