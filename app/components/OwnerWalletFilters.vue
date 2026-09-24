<script setup lang="ts">
import { emptyOwnerWalletFilter } from '#shared/finance/billetera'
import type { OwnerWalletFilter, PropiedadDelPropietario } from '#shared/finance/billetera'

/**
 * HU-62 · RF-62.14 — filtros del histórico de la billetera del Propietario:
 * propiedad y periodo, combinables. Controlado: recibe el filtro y emite el
 * completo con cada cambio; filtrar lo hace `shared/finance/billetera`.
 */
const props = defineProps<{
  filtro: OwnerWalletFilter
  propiedades: PropiedadDelPropietario[]
}>()

const emit = defineEmits<{ 'update:filtro': [OwnerWalletFilter] }>()

const { t } = useI18n()

/** El selector no admite el vacío como valor: «todas» viaja como centinela. */
const TODAS = '__todas__'

const opciones = computed(() => [
  { label: t('ownerWallet.filters.allProperties'), value: TODAS },
  ...props.propiedades.map(propiedad => ({ label: propiedad.name, value: propiedad.id })),
])

function cambiar(cambios: Partial<OwnerWalletFilter>) {
  emit('update:filtro', { ...props.filtro, ...cambios })
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-billetera-propietario"
  >
    <UFormField
      :label="t('ownerWallet.filters.property')"
      class="min-w-56 flex-1"
    >
      <USelect
        :model-value="filtro.propertyId ?? TODAS"
        :items="opciones"
        class="w-full"
        data-test="filtro-propiedad"
        @update:model-value="cambiar({ propertyId: $event === TODAS ? null : String($event) })"
      />
    </UFormField>

    <UFormField :label="t('ownerWallet.filters.from')">
      <UInput
        type="date"
        :model-value="filtro.desde ?? ''"
        data-test="filtro-desde"
        @update:model-value="cambiar({ desde: $event ? String($event) : null })"
      />
    </UFormField>

    <UFormField :label="t('ownerWallet.filters.to')">
      <UInput
        type="date"
        :model-value="filtro.hasta ?? ''"
        data-test="filtro-hasta"
        @update:model-value="cambiar({ hasta: $event ? String($event) : null })"
      />
    </UFormField>

    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      :label="t('ownerWallet.filters.clear')"
      data-test="filtro-limpiar"
      @click="emit('update:filtro', emptyOwnerWalletFilter())"
    />
  </div>
</template>
