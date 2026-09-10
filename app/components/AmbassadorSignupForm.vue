<script setup lang="ts">
import { ACCOUNT_KINDS, validateSignup } from '#shared/referrals/signup'
import type { AccountKind, SignupDraft, SignupError, SignupField } from '#shared/referrals/signup'

/**
 * HU-49 · RF-49.1, RF-49.2, RF-49.3 — la inscripción al Programa de Referidos.
 *
 * Exige aceptar los términos, cuya **versión** viaja con la inscripción para que
 * un cambio posterior no reescriba lo aceptado, y los datos bancarios del
 * desembolso. La validación es del motor puro (CA-49.1) y la base la repite.
 */
const props = defineProps<{
  termsVersion: string
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [SignupDraft] }>()

const { t } = useI18n()

const estado = reactive({
  termsAccepted: false,
  bank: '',
  accountKind: 'savings' as AccountKind,
  accountNumber: '',
  holder: '',
})

const errores = ref<SignupError[]>([])

const opcionesDeCuenta = computed(() => ACCOUNT_KINDS.map(kind => ({
  label: t(`referrals.signup.accountKinds.${kind}`),
  value: kind,
})))

function borrador(): SignupDraft {
  return {
    termsAccepted: estado.termsAccepted,
    termsVersion: props.termsVersion,
    bank: {
      bank: estado.bank.trim(),
      accountKind: estado.accountKind,
      accountNumber: estado.accountNumber.trim(),
      holder: estado.holder.trim(),
    },
  }
}

function enviar() {
  const draft = borrador()
  errores.value = validateSignup(draft)
  if (errores.value.length > 0) {
    return
  }
  emit('submit', draft)
}

function errorDe(campo: SignupField): string | undefined {
  const error = errores.value.find(e => e.name === campo)
  return error ? t(error.message) : undefined
}
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-2"
    data-test="formulario-embajador"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted sm:col-span-2">
      {{ t('referrals.signup.hint') }}
    </p>

    <UFormField
      :label="t('referrals.signup.bank')"
      :error="errorDe('bank')"
      required
      data-test="campo-embajador-banco"
    >
      <UInput
        v-model="estado.bank"
        class="w-full"
        data-test="embajador-banco"
      />
    </UFormField>

    <UFormField
      :label="t('referrals.signup.accountKind')"
      :error="errorDe('accountKind')"
      required
      data-test="campo-embajador-tipo"
    >
      <USelect
        v-model="estado.accountKind"
        :items="opcionesDeCuenta"
        class="w-full"
        data-test="embajador-tipo-cuenta"
      />
    </UFormField>

    <UFormField
      :label="t('referrals.signup.accountNumber')"
      :error="errorDe('accountNumber')"
      required
      data-test="campo-embajador-numero"
    >
      <UInput
        v-model="estado.accountNumber"
        inputmode="numeric"
        class="w-full"
        data-test="embajador-numero"
      />
    </UFormField>

    <UFormField
      :label="t('referrals.signup.holder')"
      :error="errorDe('holder')"
      required
      data-test="campo-embajador-titular"
    >
      <UInput
        v-model="estado.holder"
        class="w-full"
        data-test="embajador-titular"
      />
    </UFormField>

    <UFormField
      :error="errorDe('termsAccepted')"
      class="sm:col-span-2"
      data-test="campo-embajador-terminos"
    >
      <UCheckbox
        v-model="estado.termsAccepted"
        :label="t('referrals.signup.terms', { version: termsVersion })"
        data-test="embajador-terminos"
      />
    </UFormField>

    <div class="flex justify-end sm:col-span-2">
      <UButton
        type="submit"
        icon="i-lucide-handshake"
        :loading="enviando"
        :label="t('referrals.signup.submit')"
        data-test="enviar-inscripcion"
      />
    </div>
  </UForm>
</template>
