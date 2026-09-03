<script setup lang="ts">
import type { FichaTecnica } from '#shared/properties/ficha'
import { normalizarFicha, validarFicha } from '#shared/properties/ficha'
import type { OpcionDeCuenta } from '#shared/properties/vistas'

/**
 * HU-08 · RF-08.1 — ficha técnica de la propiedad (CA-08.3).
 *
 * El componente presenta y valida contra el dominio; no guarda nada. Las fotos no
 * son un campo de este formulario —las carga la galería— pero sí cuentan para que
 * la ficha esté completa, así que llegan como `fotos` y se validan junto al resto:
 * de otro modo el error aparecería lejos de donde se corrige.
 *
 * HU-05 · RF-05.1 y RF-05.2 · la ficha es también donde el Superadmin decide qué
 * administradores gestionan la propiedad, al crearla y al editarla. Para cualquier
 * otro rol el control no se dibuja: la política de `property_admins` solo acepta
 * escrituras del Superadmin, y ofrecer un control que la base va a rechazar es
 * mentirle a quien lo usa. Se emite la lista completa deseada; el cambio mínimo
 * contra lo vigente lo calcula `shared/properties/asignaciones.ts`.
 */
const props = withDefaults(defineProps<{
  modelo?: Partial<FichaTecnica>
  /** Cuántas fotos tiene ya la propiedad (RF-08.1). */
  fotos: number
  guardando: boolean
  modo?: 'crear' | 'editar'
  /** Cuentas con rol Administrador entre las que elegir (RF-05.1). */
  administradores?: OpcionDeCuenta[]
  /** Asignaciones vigentes de esta propiedad. */
  asignados?: string[]
  /** Solo el Superadmin asigna y retira (RF-05.1). */
  puedeAsignar?: boolean
}>(), {
  modelo: () => ({}),
  modo: 'crear',
  administradores: () => [],
  asignados: () => [],
  puedeAsignar: false,
})

const emit = defineEmits<{ submit: [FichaTecnica, string[]] }>()

const { t } = useI18n()

/** El equipamiento se escribe como texto y se guarda como lista. */
const equipamiento = ref((props.modelo.amenities ?? []).join(', '))

const estado = reactive({
  name: props.modelo.name ?? '',
  areaM2: props.modelo.areaM2 ?? 0,
  bedrooms: props.modelo.bedrooms ?? 0,
  bathrooms: props.modelo.bathrooms ?? 0,
  parkingSpots: props.modelo.parkingSpots ?? 0,
  description: props.modelo.description ?? '',
  country: props.modelo.location?.country ?? 'CO',
  region: props.modelo.location?.region ?? '',
  city: props.modelo.location?.city ?? '',
  address: props.modelo.location?.address ?? '',
  videoUrl: props.modelo.videoUrl ?? '',
})

const errores = ref<Record<string, string>>({})

/**
 * Lista completa deseada. Se parte de las asignaciones vigentes para que guardar la
 * ficha sin tocar nada no mueva ninguna asignación (RF-05.2).
 */
const asignados = ref<string[]>([...props.asignados])

/** Alterna una cuenta en la lista deseada, conservando el orden de los candidatos. */
function alternarAdministrador(id: string, marcada: boolean) {
  const elegidos = new Set(asignados.value)
  if (marcada) {
    elegidos.add(id)
  }
  else {
    elegidos.delete(id)
  }
  asignados.value = props.administradores.map(cuenta => cuenta.id).filter(cuenta => elegidos.has(cuenta))
}

function fichaActual(): FichaTecnica {
  return normalizarFicha({
    name: estado.name,
    areaM2: Number(estado.areaM2),
    bedrooms: Number(estado.bedrooms),
    bathrooms: Number(estado.bathrooms),
    parkingSpots: Number(estado.parkingSpots),
    description: estado.description,
    amenities: equipamiento.value.split(','),
    location: {
      country: estado.country,
      region: estado.region,
      city: estado.city,
      address: estado.address,
    },
    photos: props.fotos,
    videoUrl: estado.videoUrl,
    floorPlanPath: props.modelo.floorPlanPath ?? null,
  })
}

function enviar() {
  const ficha = fichaActual()
  const encontrados = validarFicha(ficha)

  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }

  emit('submit', ficha, [...asignados.value])
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-6"
    data-test="formulario-propiedad"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('properties.fields.name')"
      :error="errores.name"
      required
      data-test="campo-nombre"
    >
      <UInput
        v-model="estado.name"
        class="w-full"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UFormField
        :label="t('properties.fields.areaM2')"
        :error="errores.areaM2"
        required
        data-test="campo-area"
      >
        <UInput
          v-model="estado.areaM2"
          type="number"
          min="0"
          step="0.01"
          class="w-full font-mono"
        />
      </UFormField>

      <UFormField
        :label="t('properties.fields.bedrooms')"
        :error="errores.bedrooms"
        data-test="campo-habitaciones"
      >
        <UInput
          v-model="estado.bedrooms"
          type="number"
          min="0"
          class="w-full font-mono"
        />
      </UFormField>

      <UFormField
        :label="t('properties.fields.bathrooms')"
        :error="errores.bathrooms"
        data-test="campo-banos"
      >
        <UInput
          v-model="estado.bathrooms"
          type="number"
          min="0"
          class="w-full font-mono"
        />
      </UFormField>

      <UFormField
        :label="t('properties.fields.parkingSpots')"
        :error="errores.parkingSpots"
        data-test="campo-estacionamientos"
      >
        <UInput
          v-model="estado.parkingSpots"
          type="number"
          min="0"
          class="w-full font-mono"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('properties.fields.description')"
      :hint="t('properties.fields.descriptionHint')"
      :error="errores.description"
      required
      data-test="campo-descripcion"
    >
      <UTextarea
        v-model="estado.description"
        :rows="5"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('properties.fields.amenities')"
      :hint="t('properties.fields.amenitiesHint')"
      :error="errores.amenities"
      data-test="campo-equipamiento"
    >
      <UInput
        v-model="equipamiento"
        class="w-full"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UFormField
        :label="t('properties.fields.country')"
        :error="errores.location"
        required
        data-test="campo-pais"
      >
        <UInput
          v-model="estado.country"
          maxlength="2"
          class="w-full uppercase"
        />
      </UFormField>

      <UFormField
        :label="t('properties.fields.region')"
        required
        data-test="campo-region"
      >
        <UInput
          v-model="estado.region"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('properties.fields.city')"
        required
        data-test="campo-ciudad"
      >
        <UInput
          v-model="estado.city"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('properties.fields.address')"
        :hint="t('properties.fields.addressHint')"
        data-test="campo-direccion"
      >
        <UInput
          v-model="estado.address"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('properties.fields.videoUrl')"
      :hint="t('properties.fields.videoUrlHint')"
      :error="errores.videoUrl"
      data-test="campo-video"
    >
      <UInput
        v-model="estado.videoUrl"
        type="url"
        class="w-full"
      />
    </UFormField>

    <!-- RF-05.1 · quién gestiona esta propiedad. Solo lo ve y lo toca el Superadmin. -->
    <UFormField
      v-if="puedeAsignar"
      :label="t('properties.fields.admins')"
      :hint="t('properties.fields.adminsHint')"
      data-test="campo-administradores"
    >
      <p
        v-if="administradores.length === 0"
        class="text-sm text-muted"
        data-test="sin-administradores"
      >
        {{ t('properties.fields.noAdmins') }}
      </p>

      <!--
        Una casilla por cuenta en vez de `UCheckboxGroup`: así cada una lleva su
        propio `data-test` y el grupo se puede accionar cuenta por cuenta.
      -->
      <div
        v-else
        class="flex flex-col gap-2"
      >
        <UCheckbox
          v-for="cuenta in administradores"
          :key="cuenta.id"
          :model-value="asignados.includes(cuenta.id)"
          :label="cuenta.label"
          :data-test="`administrador-${cuenta.id}`"
          @update:model-value="alternarAdministrador(cuenta.id, $event === true)"
        />
      </div>
    </UFormField>

    <!-- Las fotos se cargan en la galería; aquí solo se avisa si faltan (RF-08.1). -->
    <UAlert
      v-if="errores.photos"
      color="error"
      variant="subtle"
      :title="errores.photos"
      data-test="error-fotos"
    />

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="guardando"
        :label="modo === 'crear' ? t('properties.actions.create') : t('properties.actions.save')"
        data-test="guardar-propiedad"
      />
    </div>
  </UForm>
</template>
