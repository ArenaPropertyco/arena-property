<script setup lang="ts">
import type { ClaveDeValidacionDeMedio, TipoDeMedio } from '#shared/properties/medios'
import { MIMES_PERMITIDOS, TIPOS_DE_MEDIO, ordenarMedios, validarArchivo } from '#shared/properties/medios'
import type { MedioConUrl } from '#shared/properties/vistas'

/**
 * HU-08 · RF-08.5 y RT-12 — fotos, video y plano elevado de la propiedad.
 *
 * El componente valida el archivo **antes** de emitirlo: formato y tamaño salen de
 * `shared/properties/medios.ts`, los mismos que declara el bucket. Así el error
 * aparece al instante y no después de subir 40 MB para que el servidor los rechace.
 *
 * Las imágenes se sirven con `@nuxt/image` (RT-12). Las URL son firmadas y caducan:
 * el bucket es privado, y quien las genera es el composable, no esta vista.
 */
const props = defineProps<{
  medios: MedioConUrl[]
  puedeGestionar: boolean
  subiendo: boolean
}>()

const emit = defineEmits<{
  subir: [{ tipo: TipoDeMedio, archivos: File[] }]
  quitar: [string]
}>()

const { t } = useI18n()

const error = ref<ClaveDeValidacionDeMedio | null>(null)

const porTipo = computed(() => TIPOS_DE_MEDIO.map(tipo => ({
  tipo,
  medios: ordenarMedios(props.medios, tipo) as MedioConUrl[],
  acepta: MIMES_PERMITIDOS[tipo].join(','),
})))

const vacia = computed(() => props.medios.length === 0)

function elegir(tipo: TipoDeMedio, evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const archivos = [...(entrada.files ?? [])]
  error.value = null

  if (archivos.length === 0) {
    return
  }

  // Basta con que uno no pase: subir «los que sí» dejaría al administrador sin
  // saber cuál faltó y con la galería a medias.
  for (const archivo of archivos) {
    const problema = validarArchivo({ tipo, mime: archivo.type, size: archivo.size })
    if (problema) {
      error.value = problema
      entrada.value = ''
      return
    }
  }

  emit('subir', { tipo, archivos })
  entrada.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="t(error)"
      data-test="error-medio"
    />

    <p
      v-if="vacia"
      class="text-sm text-muted"
      data-test="galeria-vacia"
    >
      {{ t('properties.media.empty') }}
    </p>

    <section
      v-for="grupo in porTipo"
      :key="grupo.tipo"
      class="space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-medium">
          {{ t(`properties.media.${grupo.tipo}`) }}
        </h3>

        <label
          v-if="puedeGestionar"
          class="cursor-pointer text-sm text-primary"
          :data-test="`subir-${grupo.tipo}`"
        >
          {{ subiendo ? t('properties.media.uploading') : t('properties.media.add') }}
          <input
            type="file"
            class="sr-only"
            multiple
            :accept="grupo.acepta"
            :disabled="subiendo"
            @change="elegir(grupo.tipo, $event)"
          >
        </label>
      </div>

      <ul
        v-if="grupo.medios.length > 0"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        :data-test="`galeria-${grupo.tipo}`"
      >
        <li
          v-for="medio in grupo.medios"
          :key="medio.id"
          class="group relative overflow-hidden rounded-lg border border-default"
        >
          <NuxtImg
            v-if="grupo.tipo !== 'video'"
            :src="medio.url"
            :alt="''"
            loading="lazy"
            class="aspect-4/3 w-full object-cover"
          />
          <video
            v-else
            :src="medio.url"
            controls
            class="aspect-4/3 w-full object-cover"
          />

          <UButton
            v-if="puedeGestionar"
            color="error"
            variant="solid"
            size="xs"
            icon="i-lucide-trash-2"
            class="absolute top-1 right-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
            :aria-label="t('properties.media.remove')"
            :data-test="`quitar-${medio.id}`"
            @click="emit('quitar', medio.id)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
