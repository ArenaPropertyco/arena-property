<script setup lang="ts">
import { propiedadesGestionadas } from '#shared/properties/asignaciones'
import type { FichaTecnica } from '#shared/properties/ficha'

/**
 * HU-08 · RF-08.1, HU-10 · RF-10.1, RF-10.2 y HU-22 · RF-22.1…RF-22.3 — listado y
 * buscador de propiedades.
 *
 * La página orquesta: carga con el composable, pasa props y atiende eventos. La
 * RLS deja pasar lo publicado a cualquiera, así que el Administrador ve primero
 * recortado a lo que administra (CA-22.3) y busca sobre eso, por nombre o
 * ubicación, sin acentos ni mayúsculas (CA-22.1) y combinando región y estados
 * (CA-22.2). El Superadmin busca sobre todas.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'gestionar_propiedades' } })

const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()

const { roles, idDeCuenta } = useCuenta()
const { propiedades, pendiente, crear } = usePropiedades()
const esSuperadmin = computed(() => roles.value.includes('superadmin'))
// RF-22.3 · nunca se busca entre lo que no se administra.
const gestionadas = computed(() => propiedadesGestionadas(propiedades.value, { id: idDeCuenta.value, esSuperadmin: esSuperadmin.value }))
const { filtro, filtradas, regiones, administradores } = useFiltrosDePropiedades(gestionadas)
// RF-05.1 · las cuentas con rol Administrador entre las que puede elegir.
const { administradores: candidatos } = useAdministradores()
const opcionesDeAdmin = computed(() => candidatos.value
  .map(cuenta => ({ id: cuenta.id, label: cuenta.fullName ?? cuenta.email ?? cuenta.id })))

const creando = ref(false)
const guardando = ref(false)

async function crearPropiedad(ficha: FichaTecnica, asignados: string[]) {
  guardando.value = true
  // Solo el Superadmin gestiona asignaciones; para el resto se pasa `null` para que
  // la lista vacía del formulario no retire la que le acaba de dar RF-08.6.
  const resultado = await crear(ficha, esSuperadmin.value ? asignados : null)
  guardando.value = false

  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }

  creando.value = false
  toast.add({ title: t('properties.messages.created'), color: 'success' })
  await navigateTo(localePath(`/panel/propiedades/${resultado.id}`))
}

function abrir(id: string) {
  return navigateTo(localePath(`/panel/propiedades/${id}`))
}
</script>

<template>
  <PanelPage
    :titulo="t('properties.title')"
    :subtitulo="t('properties.subtitle')"
  >
    <div class="space-y-6">
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-plus"
          :label="t('properties.new')"
          data-test="nueva-propiedad"
          @click="creando = true"
        />
      </div>

      <PropertyFilters
        v-model:filtro="filtro"
        :regiones="regiones"
        :administradores="administradores"
        :total="gestionadas.length"
        :mostradas="filtradas.length"
      />

      <PropertiesTable
        :propiedades="filtradas"
        :pendiente="pendiente"
        @abrir="abrir"
      />
    </div>

    <USlideover
      v-model:open="creando"
      :title="t('properties.new')"
    >
      <template #body>
        <!-- La ficha nace sin fotos: la galería se abre al guardarla (RF-08.5). -->
        <PropertyForm
          :fotos="1"
          :guardando="guardando"
          modo="crear"
          :administradores="opcionesDeAdmin"
          :puede-asignar="esSuperadmin"
          @submit="crearPropiedad"
        />
      </template>
    </USlideover>
  </PanelPage>
</template>
