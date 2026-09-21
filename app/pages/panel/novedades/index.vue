<script setup lang="ts">
import { puede } from '#shared/permissions/mapa'
import type { NuevaNovedad } from '#shared/notifications/novedades'

/**
 * HU-29 · RF-29.1, RF-29.3 · HU-30 · RF-30.1, RF-30.3 — las novedades de las
 * propiedades de quien mira.
 *
 * La página orquesta: carga el historial ya ordenado por `useNovedades`, filtra
 * por propiedad y estado, y traduce cada acción en un aviso. Quien gestiona
 * alguna propiedad publica —a toda la propiedad o a una fracción (RF-29.5)— y
 * resuelve (`enviar_novedades` en la matriz de HU-07); solo el Superadmin activa o
 * desactiva (RF-29.6, D-46); el Propietario lee el historial de las suyas,
 * resueltas incluidas y solo las activas. Qué ve cada quien lo decide la RLS.
 * Llega con `?propiedad=` desde el tablero o la ficha.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const { roles } = useCuenta()
const {
  filtradas, filtro, propiedadesGestionables, propiedadesDelFiltro, fracciones, pendiente, publicar, resolver, cambiarVisibilidad,
} = useNovedades()

const puedePublicar = computed(() => puede(roles.value, 'enviar_novedades') && propiedadesGestionables.value.length > 0)
// RF-29.6 · D-46 · el estado activa/inactiva es del Superadmin; la RLS lo repite.
const puedeCambiarVisibilidad = computed(() => roles.value.includes('superadmin'))

const publicando = ref(false)
const ocupado = ref(false)

// RF-30.3 · la propiedad de la que se viene queda elegida en el filtro.
const propiedadInicial = computed(() => String(ruta.query.propiedad ?? ''))
watch(propiedadInicial, (id) => {
  if (id) {
    filtro.value = { ...filtro.value, propertyId: id }
  }
}, { immediate: true })

function avisar(resultado: { ok: true } | { ok: false, clave: string }, exito: string): boolean {
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
  return resultado.ok
}

async function guardar(nueva: NuevaNovedad) {
  ocupado.value = true
  const resultado = await publicar(nueva)
  ocupado.value = false
  if (avisar(resultado, 'announcements.messages.published')) {
    publicando.value = false
  }
}

async function marcarResuelta(id: string) {
  ocupado.value = true
  avisar(await resolver(id), 'announcements.messages.resolved')
  ocupado.value = false
}

async function fijarVisibilidad(id: string, active: boolean) {
  ocupado.value = true
  avisar(await cambiarVisibilidad(id, active), active ? 'announcements.messages.activated' : 'announcements.messages.deactivated')
  ocupado.value = false
}
</script>

<template>
  <PanelPage
    :titulo="t('announcements.title')"
    :subtitulo="t('announcements.subtitle')"
  >
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p
          v-if="!puedePublicar"
          class="text-sm text-muted"
          data-test="solo-lectura"
        >
          {{ t('announcements.readOnly') }}
        </p>
        <UButton
          v-else
          icon="i-lucide-megaphone"
          :label="t('announcements.publish')"
          data-test="publicar-novedad"
          @click="publicando = true"
        />
      </div>

      <AnnouncementFilters
        v-model:filtro="filtro"
        :propiedades="propiedadesDelFiltro"
      />

      <AnnouncementsList
        :novedades="filtradas"
        :puede-resolver="puedePublicar"
        :puede-cambiar-visibilidad="puedeCambiarVisibilidad"
        :pendiente="pendiente"
        @resolver="marcarResuelta"
        @cambiar-visibilidad="fijarVisibilidad"
      />
    </div>

    <USlideover
      v-model:open="publicando"
      :title="t('announcements.publishTitle')"
      :description="t('announcements.publishHint')"
    >
      <template #body>
        <AnnouncementForm
          v-if="publicando"
          :propiedades="propiedadesGestionables"
          :fracciones="fracciones"
          :puede-cambiar-visibilidad="puedeCambiarVisibilidad"
          :enviando="ocupado"
          @submit="guardar"
        />
      </template>
    </USlideover>
  </PanelPage>
</template>
