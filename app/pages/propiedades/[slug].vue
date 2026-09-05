<script setup lang="ts">
import type { SolicitudDeContacto } from '#shared/contact/esquema'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * HU-02 · RF-02.1…RF-02.6 y HU-03 · RF-03.1, RF-03.4 — la ficha pública.
 *
 * La página orquesta: resuelve por slug (404 para el Visitante si no está
 * publicada; vista previa para quien la administra), monta galería, ficha, plano y
 * el formulario de contacto de la misma página, y anota cada envío en un aviso.
 */
const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const localePath = useLocalePath()

const slug = computed(() => String(ruta.params.slug ?? ''))

const { resolucion, propiedad, esperar } = usePropiedadPublica(slug)
const { modo } = useModoDelPlano()
const { codigo } = useCodigoDeReferido()
const { enviar } = useContacto()

const formulario = ref<{ enfocar: () => void } | null>(null)
const enviando = ref(false)

useSeoMeta({
  title: () => propiedad.value?.name ?? t('property.notFound'),
  description: () => propiedad.value?.description.slice(0, 160) ?? '',
  ogTitle: () => propiedad.value?.name ?? '',
  ogImage: () => propiedad.value?.photoUrl ?? '/media/invictvs-hero.jpg',
})

// RF-02.1 · CA-02.2 · sin fila para esta sesión, la respuesta es un 404 de verdad,
// también en el servidor: por eso se espera la consulta en el setup.
await esperar()
if (resolucion.value.estado === 'no_encontrada') {
  throw createError({ statusCode: 404, statusMessage: t('property.notFound'), fatal: true })
}

/** RF-03.1 · el botón «Contáctanos» desplaza y enfoca el formulario de la misma página. */
function irAlContacto() {
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.setTimeout(() => formulario.value?.enfocar(), 400)
}

async function enviarContacto(solicitud: SolicitudDeContacto) {
  enviando.value = true
  const resultado = await enviar(solicitud, 'property')
  enviando.value = false

  toast.add(resultado.ok
    ? { title: resultado.correoEnviado === false ? t('contact.sentNoEmail') : t('contact.sent'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <div v-if="propiedad">
    <UContainer class="space-y-10 py-8 sm:py-12">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          :to="localePath(RUTAS_PUBLICAS.catalogo)"
          :label="t('property.backToCatalog')"
        />
        <UButton
          icon="i-lucide-mail"
          :label="t('property.contactUs')"
          data-test="ir-a-contacto"
          @click="irAlContacto"
        />
      </div>

      <PropertyDraftBadge v-if="resolucion.estado === 'vista_previa'" />

      <header class="space-y-2">
        <p class="text-xs uppercase tracking-[0.25em] text-muted">
          {{ propiedad.city }} · {{ propiedad.region }}
        </p>
        <h1 class="font-display text-4xl font-medium text-highlighted sm:text-6xl">
          {{ propiedad.name }}
        </h1>
      </header>

      <PropertyGallery
        :fotos="propiedad.fotos"
        :nombre="propiedad.name"
      />

      <div class="grid gap-10 lg:grid-cols-3">
        <div class="space-y-10 lg:col-span-2">
          <section class="space-y-4">
            <SectionHeading :titulo="t('property.description')" />
            <p class="whitespace-pre-line text-base leading-relaxed text-default">
              {{ propiedad.description }}
            </p>
          </section>

          <section class="space-y-4">
            <SectionHeading :titulo="t('property.amenities')" />
            <PropertyAmenities :amenities="propiedad.amenities" />
          </section>

          <section class="space-y-4">
            <SectionHeading :titulo="t('property.floorPlan')" />
            <FloorPlanViewer
              :plano="propiedad.plano"
              :modelo="propiedad.modelo"
              :modo="modo"
            />
          </section>

          <section
            v-if="propiedad.video || propiedad.videoUrl"
            class="space-y-4"
          >
            <SectionHeading :titulo="t('property.video')" />
            <video
              v-if="propiedad.video"
              :src="propiedad.video.url"
              class="w-full rounded-2xl"
              controls
              playsinline
              preload="metadata"
            />
            <UButton
              v-else-if="propiedad.videoUrl"
              variant="outline"
              icon="i-lucide-play"
              :to="propiedad.videoUrl"
              target="_blank"
              rel="noopener"
              :label="t('property.video')"
            />
          </section>
        </div>

        <aside class="lg:sticky lg:top-24 lg:self-start">
          <PropertyPublicSheet :propiedad="propiedad" />
        </aside>
      </div>

      <section
        id="contacto"
        class="scroll-mt-24 space-y-6 rounded-2xl border border-default bg-elevated/30 p-6 sm:p-10"
      >
        <div>
          <h2 class="font-display text-3xl font-medium text-highlighted">
            {{ t('property.contactTitle', { name: propiedad.name }) }}
          </h2>
          <p class="mt-2 text-sm text-muted">
            {{ t('property.contactSubtitle') }}
          </p>
        </div>
        <PropertyContactForm
          ref="formulario"
          :propiedad="{ id: propiedad.id, name: propiedad.name }"
          :codigo-referido="codigo"
          :enviando="enviando"
          @submit="enviarContacto"
        />
      </section>
    </UContainer>
  </div>
</template>
