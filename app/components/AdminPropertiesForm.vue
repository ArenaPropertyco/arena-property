<script setup lang="ts">
import type { Administrador } from '#shared/identity/cuentas'
import type { PropiedadAsignable } from '~/composables/useAdministradores'

/**
 * HU-05 · RF-05.1, RF-05.2 — qué propiedades administra una cuenta, editadas desde
 * el lado del administrador. Emite la lista completa deseada; el composable calcula
 * el cambio mínimo, así que desmarcar una propiedad la retira sin borrar histórico.
 */
const props = defineProps<{
  administrador: Administrador
  propiedades: PropiedadAsignable[]
  guardando: boolean
}>()

const emit = defineEmits<{ submit: [propertyIds: string[]] }>()

const { t } = useI18n()

const asignadas = ref<string[]>([...props.administrador.propiedades])

function alternar(id: string, marcada: boolean) {
  const elegidas = new Set(asignadas.value)
  if (marcada) {
    elegidas.add(id)
  }
  else {
    elegidas.delete(id)
  }
  asignadas.value = props.propiedades.map(propiedad => propiedad.id).filter(id => elegidas.has(id))
}
</script>

<template>
  <UForm
    :state="{ asignadas }"
    class="space-y-4"
    data-test="formulario-propiedades-admin"
    @submit.prevent="emit('submit', asignadas)"
  >
    <p class="text-sm text-muted">
      {{ t('admins.propertiesFormHint') }}
    </p>

    <p
      v-if="propiedades.length === 0"
      class="text-sm text-muted"
      data-test="sin-propiedades"
    >
      {{ t('admins.noPropertiesAvailable') }}
    </p>

    <div
      v-else
      class="flex flex-col gap-2"
    >
      <UCheckbox
        v-for="propiedad in propiedades"
        :key="propiedad.id"
        :model-value="asignadas.includes(propiedad.id)"
        :label="propiedad.name"
        :data-test="`propiedad-${propiedad.id}`"
        @update:model-value="alternar(propiedad.id, $event === true)"
      />
    </div>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="guardando"
        :label="t('admins.saveProperties')"
        data-test="guardar-propiedades"
      />
    </div>
  </UForm>
</template>
