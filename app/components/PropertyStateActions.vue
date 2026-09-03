<script setup lang="ts">
import type { Visibilidad } from '#shared/properties/estados'
import { TRANSICIONES_DE_VISIBILIDAD } from '#shared/properties/estados'

/**
 * HU-08 · RF-08.2, RF-08.3 — las acciones de estado que caben en este momento.
 *
 * Qué se ofrece no lo decide este componente: sale de la misma tabla de transiciones
 * que valida el dominio y que hace cumplir la base. Así no existe un botón que la
 * base vaya a rechazar, ni una transición legítima que la pantalla esconda.
 */
const props = defineProps<{
  visibility: Visibilidad
  comingSoon: boolean
  /** Ya tiene sus 8 fracciones: sin ellas no hay estado comercial que derivar. */
  fraccionada: boolean
  ocupado?: boolean
}>()

defineEmits<{
  visibilidad: [Visibilidad]
  salirDeProximamente: []
}>()

const { t } = useI18n()

/** Destinos válidos desde el estado actual, con la etiqueta que le toca a cada uno. */
const destinos = computed(() => TRANSICIONES_DE_VISIBILIDAD[props.visibility].map(destino => ({
  destino,
  etiqueta: destino === 'published'
    ? (props.visibility === 'inactive' ? 'properties.actions.reactivate' : 'properties.actions.publish')
    : 'properties.actions.deactivate',
  color: destino === 'published' ? 'primary' as const : 'neutral' as const,
})))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-for="opcion in destinos"
      :key="opcion.destino"
      :color="opcion.color"
      variant="subtle"
      size="sm"
      :loading="ocupado"
      :data-test="`accion-${opcion.destino}`"
      :label="t(opcion.etiqueta)"
      @click="$emit('visibilidad', opcion.destino)"
    />

    <!-- RF-08.3 · «Próximamente» solo tiene salida, y solo con las 8 fracciones. -->
    <UButton
      v-if="comingSoon"
      color="primary"
      variant="outline"
      size="sm"
      :disabled="!fraccionada"
      :loading="ocupado"
      data-test="accion-release"
      :label="t('properties.actions.release')"
      @click="$emit('salirDeProximamente')"
    />
  </div>
</template>
