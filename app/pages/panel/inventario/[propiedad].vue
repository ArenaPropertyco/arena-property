<script setup lang="ts">
import { mantenimientosDe, mantenimientosDeLaPropiedad } from '#shared/finance/mantenimiento'
import type { ItemParaGasto } from '#shared/finance/mantenimiento'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import { puede } from '#shared/permissions/mapa'
import type { NuevoItem } from '#shared/properties/inventario'

/**
 * HU-26 · RF-26.1…RF-26.4 · HU-27 · RF-27.1…RF-27.3 · HU-28 · RF-28.1, RF-28.2 —
 * el inventario y los mantenimientos de una propiedad.
 *
 * La página orquesta: carga ítems, histórico y mantenimientos ya resueltos por
 * `useInventario`, monta los componentes y traduce cada resultado en un aviso.
 * Registrar, editar y dar de baja es del Superadmin y del Administrador asignado
 * (`gestionar_inventario` en la matriz de HU-07, D-45); el Propietario entra en lectura
 * y la RLS solo le entrega los ítems activos (CA-28.3). Un mantenimiento es un
 * gasto de HU-23 con ítem y factura: lo reparte la base (RF-27.2).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'gestionar_inventario' } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const localePath = useLocalePath()
const { roles } = useCuenta()

const propiedadId = computed(() => String(ruta.params.propiedad ?? ''))

const { maestra } = useMaestraContable()
const {
  propiedad, items, historialDe, mantenimientos, pendiente,
  registrarItem, actualizarItem, darDeBaja, registrarMantenimiento,
} = useInventario(propiedadId)

const puedeGestionar = computed(() => puede(roles.value, 'gestionar_inventario', { escritura: true }))

const editando = ref<string | null>(null)
const creando = ref(false)
const retirando = ref<string | null>(null)
const viendoHistorial = ref<string | null>(null)
const registrandoMantenimiento = ref(false)
const ocupado = ref(false)

const itemEditado = computed(() => items.value.find(item => item.id === editando.value) ?? null)
const itemDelHistorial = computed(() => items.value.find(item => item.id === viendoHistorial.value) ?? null)
const formularioAbierto = computed({
  get: () => creando.value || editando.value !== null,
  set: (abierto: boolean) => {
    if (!abierto) {
      creando.value = false
      editando.value = null
    }
  },
})

/** RF-27.1 · a qué ítem se puede asociar un gasto: a cualquiera, señalando los dados de baja. */
const itemsParaGasto = computed<ItemParaGasto[]>(() => items.value.map(item => ({ id: item.id, name: item.name, retired: item.retiredAt !== null })))

const mantenimientosDeLaCasa = computed(() => mantenimientosDeLaPropiedad(mantenimientos.value))
const mantenimientosDelItem = computed(() => viendoHistorial.value ? mantenimientosDe(mantenimientos.value, viendoHistorial.value) : [])

function avisar(resultado: { ok: true } | { ok: false, clave: string }, exito: string): boolean {
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
  return resultado.ok
}

async function guardarItem(nuevo: NuevoItem) {
  ocupado.value = true
  const resultado = editando.value
    ? await actualizarItem(editando.value, nuevo)
    : await registrarItem(nuevo)
  ocupado.value = false

  if (avisar(resultado, editando.value ? 'inventory.messages.updated' : 'inventory.messages.registered')) {
    formularioAbierto.value = false
  }
}

async function confirmarBaja(motivo: string) {
  const item = retirando.value
  if (!item) {
    return
  }
  ocupado.value = true
  const resultado = await darDeBaja(item, motivo)
  ocupado.value = false
  if (avisar(resultado, 'inventory.messages.retired')) {
    retirando.value = null
  }
}

async function guardarMantenimiento(nuevo: NuevoMovimiento, archivo: File | null) {
  ocupado.value = true
  const resultado = await registrarMantenimiento(nuevo, archivo)
  ocupado.value = false
  if (avisar(resultado, 'inventory.messages.maintenanceRegistered')) {
    registrandoMantenimiento.value = false
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('inventory.title')"
    :subtitulo="propiedad?.name ?? undefined"
  >
    <p
      v-if="pendiente && !propiedad"
      class="text-sm text-muted"
      data-test="inventario-cargando"
    >
      {{ t('inventory.loading') }}
    </p>

    <p
      v-else-if="!propiedad"
      class="text-sm text-muted"
      data-test="propiedad-no-encontrada"
    >
      {{ t('inventory.notFound') }}
    </p>

    <div
      v-else
      class="space-y-8"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          v-if="puedeGestionar"
          variant="link"
          size="sm"
          icon="i-lucide-arrow-left"
          :to="localePath(`/panel/propiedades/${propiedad.id}`)"
          :label="propiedad.name"
          data-test="volver-a-propiedad"
        />
        <p
          v-else
          class="text-sm text-muted"
          data-test="solo-lectura"
        >
          {{ t('inventory.readOnly') }}
        </p>

        <div
          v-if="puedeGestionar"
          class="flex flex-wrap gap-2"
        >
          <UButton
            variant="outline"
            size="sm"
            icon="i-lucide-wrench"
            :label="t('inventory.maintenance.register')"
            data-test="registrar-mantenimiento"
            @click="registrandoMantenimiento = true"
          />
          <UButton
            size="sm"
            icon="i-lucide-plus"
            :label="t('inventory.register')"
            data-test="registrar-item"
            @click="creando = true"
          />
        </div>
      </div>

      <section class="space-y-4">
        <SectionHeading :titulo="t('inventory.subtitle')" />
        <InventoryTable
          :items="items"
          :puede-gestionar="puedeGestionar"
          @editar="editando = $event"
          @dar-de-baja="retirando = $event"
          @ver-historial="viendoHistorial = $event"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('inventory.maintenance.title')" />
        <p class="text-sm text-muted">
          {{ t('inventory.maintenance.subtitle') }}
        </p>
        <MaintenanceTable :movimientos="mantenimientosDeLaCasa" />
      </section>
    </div>

    <USlideover
      v-model:open="formularioAbierto"
      :title="editando ? t('inventory.editTitle') : t('inventory.registerTitle')"
    >
      <template #body>
        <InventoryItemForm
          v-if="formularioAbierto"
          :key="editando ?? 'nuevo'"
          :property-id="propiedadId"
          :item="itemEditado"
          :enviando="ocupado"
          @submit="guardarItem"
        />
      </template>
    </USlideover>

    <USlideover
      v-model:open="registrandoMantenimiento"
      :title="t('inventory.maintenance.registerTitle')"
    >
      <template #body>
        <MovementForm
          v-if="registrandoMantenimiento"
          :property-id="propiedadId"
          :maestra="maestra"
          :fracciones="[]"
          :items="itemsParaGasto"
          mantenimiento
          :enviando="ocupado"
          @submit="guardarMantenimiento"
        />
      </template>
    </USlideover>

    <UModal
      :open="retirando !== null"
      :title="t('inventory.retireTitle')"
      @update:open="retirando = null"
    >
      <template #body>
        <ReasonForm
          :descripcion="t('inventory.retireHint')"
          :etiqueta="t('inventory.confirmRetire')"
          :enviando="ocupado"
          @submit="confirmarBaja"
        />
      </template>
    </UModal>

    <UModal
      :open="viendoHistorial !== null"
      :title="t('inventory.historyTitle')"
      :description="itemDelHistorial?.name"
      @update:open="viendoHistorial = null"
    >
      <template #body>
        <InventoryHistoryList
          v-if="viendoHistorial"
          :entradas="historialDe(viendoHistorial)"
          :mantenimientos="mantenimientosDelItem"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
