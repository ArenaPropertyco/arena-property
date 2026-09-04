<script setup lang="ts">
import { normalizarCodigoReferido, normalizarEmail } from '#shared/identity/registro'
import { esImporte, pesos } from '#shared/money/importe'
import { filtrarCuentas } from '#shared/properties/asignaciones'
import type { FraccionListada } from '#shared/properties/vistas'
import { validarInvitacion } from '#shared/purchases/invitaciones'
import type { SolicitudDeInvitacion } from '#shared/purchases/invitaciones'
import type { CuentaConocida } from '#shared/purchases/vistas'

/**
 * HU-06 · RF-06.1, RF-06.2 — vincular un propietario a una fracción concreta.
 *
 * Un solo formulario para el caso real del Superadmin: el trato ya está hecho y
 * quiere que alguien, con cuenta o sin ella, sea propietario de la fracción. Se
 * escribe el correo (o se elige una cuenta existente entre las sugerencias), el
 * precio pactado y, si se deja marcado «Registrar la venta ahora», la página cierra
 * la compra en el acto: titularidad, rol Propietario y plan de pagos (CA-06.2,
 * CA-06.3). Sin marcarlo queda una invitación pendiente que se cierra después.
 *
 * El precio pactado se propone con el de lista pero se puede negociar: es el que
 * quedará congelado en el plan de pagos (RF-58.1). Es dinero, así que un decimal no
 * llega a construirse como importe (TR-02).
 *
 * RF-06.4 · el código del embajador es opcional; escrito, tiene que tener formato
 * plausible, porque quien invita lo copia a propósito. Viaja normalizado.
 *
 * El componente no sabe quién mira: la pantalla lo monta solo para quien gestiona
 * la propiedad y la base vuelve a comprobarlo (CA-06.1). Aquí se validan los campos.
 */
const props = withDefaults(defineProps<{
  fraccion: FraccionListada
  enviando: boolean
  /** Cuentas que la sesión puede ver, para vincular sin crear otra. */
  cuentas?: CuentaConocida[]
}>(), { cuentas: () => [] })

const emit = defineEmits<{ submit: [SolicitudDeInvitacion, { cerrarAhora: boolean }] }>()

const { t } = useI18n()

const estado = reactive({
  email: '',
  agreedPrice: String(props.fraccion.listPrice),
  referralCode: '',
  cerrarAhora: true,
})

const errores = ref<Record<string, string>>({})

const MAXIMO_DE_SUGERENCIAS = 5
const CORREO_PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** La cuenta cuyo correo coincide exactamente con lo escrito, si la hay. */
const cuentaConocida = computed(() => {
  const correo = normalizarEmail(estado.email)
  if (correo === '') {
    return null
  }
  return props.cuentas.find(cuenta => cuenta.email && normalizarEmail(cuenta.email) === correo) ?? null
})

const esCorreoNuevo = computed(() => cuentaConocida.value === null && CORREO_PLAUSIBLE.test(normalizarEmail(estado.email)))

/** Sugerencias por nombre o correo mientras se escribe; desaparecen al acertar. */
const sugerencias = computed(() => {
  const texto = estado.email.trim()
  if (texto.length < 2 || cuentaConocida.value) {
    return []
  }
  return filtrarCuentas(props.cuentas, texto)
    .filter(cuenta => cuenta.email)
    .slice(0, MAXIMO_DE_SUGERENCIAS)
})

function etiqueta(cuenta: CuentaConocida): string {
  return cuenta.fullName ? `${cuenta.fullName} · ${cuenta.email ?? ''}` : (cuenta.email ?? cuenta.id)
}

function elegir(cuenta: CuentaConocida) {
  estado.email = cuenta.email ?? ''
}

function enviar() {
  const numero = Number(estado.agreedPrice)
  const solicitud: SolicitudDeInvitacion = {
    fractionId: props.fraccion.id,
    propertyId: props.fraccion.propertyId,
    fractionStatus: props.fraccion.status,
    email: estado.email,
    agreedPrice: esImporte(numero) ? pesos(numero) : pesos(0),
    referralCode: normalizarCodigoReferido(estado.referralCode),
  }

  const encontrados = validarInvitacion(solicitud, { administraLaPropiedad: true })
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }

  emit('submit', solicitud, { cerrarAhora: estado.cerrarAhora })
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-invitacion"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('purchases.inviteHint') }}
    </p>

    <UFormField
      :label="t('purchases.email')"
      :error="errores.email"
      required
      data-test="campo-correo-comprador"
    >
      <UInput
        v-model="estado.email"
        type="email"
        autocomplete="off"
        class="w-full"
      />

      <template #help>
        <span
          v-if="cuentaConocida"
          class="inline-flex items-center gap-1 text-success"
          data-test="cuenta-conocida"
        >
          <UIcon name="i-lucide-user-check" />
          {{ t('purchases.knownAccount', { name: cuentaConocida.fullName ?? cuentaConocida.email ?? '' }) }}
        </span>
        <span
          v-else-if="esCorreoNuevo"
          class="inline-flex items-center gap-1"
          data-test="cuenta-nueva"
        >
          <UIcon name="i-lucide-user-plus" />
          {{ t('purchases.newAccount') }}
        </span>
      </template>
    </UFormField>

    <div
      v-if="sugerencias.length > 0"
      class="space-y-1"
      data-test="sugerencias-de-cuenta"
    >
      <p class="text-xs text-muted">
        {{ t('purchases.existingAccounts') }}
      </p>
      <div class="flex flex-wrap gap-1">
        <UButton
          v-for="cuenta in sugerencias"
          :key="cuenta.id"
          type="button"
          variant="soft"
          color="neutral"
          size="xs"
          icon="i-lucide-user"
          :label="etiqueta(cuenta)"
          :data-test="`sugerencia-${cuenta.id}`"
          @click="elegir(cuenta)"
        />
      </div>
    </div>

    <UFormField
      :label="t('purchases.agreedPrice')"
      :hint="t('purchases.agreedPriceHint')"
      :error="errores.agreedPrice"
      required
      data-test="campo-precio-pactado"
    >
      <UInput
        v-model="estado.agreedPrice"
        type="number"
        min="1"
        step="1"
        class="w-full font-mono"
      />
    </UFormField>

    <UFormField
      :label="t('purchases.referralCode')"
      :hint="t('purchases.referralCodeHint')"
      :error="errores.referralCode"
      data-test="campo-codigo-referido"
    >
      <UInput
        v-model="estado.referralCode"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        class="w-full font-mono uppercase"
      />
    </UFormField>

    <UCheckbox
      v-model="estado.cerrarAhora"
      :label="t('purchases.closeNow')"
      :description="t('purchases.closeNowHint')"
      data-test="cerrar-ahora"
    />

    <p
      v-if="errores.fractionStatus"
      class="text-sm text-error"
      data-test="error-fraccion"
    >
      {{ errores.fractionStatus }}
    </p>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :icon="estado.cerrarAhora ? 'i-lucide-badge-check' : 'i-lucide-mail'"
        :label="estado.cerrarAhora ? t('purchases.linkSubmit') : t('purchases.send')"
        data-test="enviar-invitacion"
      />
    </div>
  </UForm>
</template>
