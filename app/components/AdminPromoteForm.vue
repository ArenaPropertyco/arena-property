<script setup lang="ts">
import { filtrarCuentas } from '#shared/properties/asignaciones'
import type { CuentaPromovible } from '#shared/properties/asignaciones'

/**
 * HU-05 · RF-05.1 — dar el rol Administrador a una cuenta que ya existe.
 *
 * Complementa la invitación por correo: quien ya se registró no necesita otra
 * cuenta. Se busca por nombre o correo y se elige de una lista visible, no de un
 * desplegable: otorgar un rol operativo merece ver a quién se le da.
 */
const props = defineProps<{
  candidatos: CuentaPromovible[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [cuentaId: string] }>()

const { t } = useI18n()

const busqueda = ref('')
const elegida = ref('')

const coincidencias = computed(() => filtrarCuentas(props.candidatos, busqueda.value))

const opciones = computed(() => coincidencias.value.map(cuenta => ({
  value: cuenta.id,
  label: cuenta.fullName ? `${cuenta.fullName} · ${cuenta.email ?? ''}` : (cuenta.email ?? cuenta.id),
})))

function enviar() {
  if (!elegida.value || props.enviando) {
    return
  }
  emit('submit', elegida.value)
  elegida.value = ''
}
</script>

<template>
  <UPageCard>
    <template #header>
      <SectionHeading :titulo="t('admins.promote')" />
    </template>

    <UForm
      :state="{ busqueda, elegida }"
      class="space-y-4"
      data-test="formulario-promover"
      @submit.prevent="enviar"
    >
      <p class="text-sm text-muted">
        {{ t('admins.promoteHint') }}
      </p>

      <p
        v-if="candidatos.length === 0"
        class="text-sm text-muted"
        data-test="sin-candidatos"
      >
        {{ t('admins.noCandidates') }}
      </p>

      <template v-else>
        <UFormField
          :label="t('admins.search')"
          data-test="campo-busqueda"
        >
          <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('admins.candidates')"
          data-test="campo-candidatos"
        >
          <p
            v-if="opciones.length === 0"
            class="text-sm text-muted"
            data-test="sin-coincidencias"
          >
            {{ t('admins.noMatches') }}
          </p>
          <URadioGroup
            v-else
            v-model="elegida"
            :items="opciones"
            value-key="value"
            data-test="selector-cuenta"
          />
        </UFormField>

        <div class="flex justify-end">
          <UButton
            type="submit"
            :disabled="!elegida"
            :loading="enviando"
            :label="t('admins.promoteSubmit')"
            data-test="enviar-promocion"
          />
        </div>
      </template>
    </UForm>
  </UPageCard>
</template>
