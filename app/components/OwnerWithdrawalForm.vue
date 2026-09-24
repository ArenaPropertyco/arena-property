<script setup lang="ts">
import type { SaldoDePropiedad } from '#shared/finance/billetera'
import { hasOpenOwnerWithdrawal, validateOwnerWithdrawal } from '#shared/finance/retiros-propietario'
import type { NuevoRetiroDePropietario, OwnerWithdrawal } from '#shared/finance/retiros-propietario'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import { esImporte, pesos } from '#shared/money/importe'
import { ACCOUNT_KINDS } from '#shared/referrals/signup'
import type { AccountKind } from '#shared/referrals/signup'

/**
 * HU-62 · RF-62.9 · CA-62.10 · D-51 — solicitar el retiro del saldo positivo de
 * una propiedad.
 *
 * Solo ofrece las propiedades con saldo positivo; con una solicitud abierta
 * sobre la elegida no ofrece el formulario: primero se resuelve esa. Valida con
 * el dominio antes de emitir; la base vuelve a rechazar lo mismo.
 */
const props = defineProps<{
  saldos: SaldoDePropiedad[]
  solicitudes: Pick<OwnerWithdrawal, 'status' | 'propertyId'>[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [{ propertyId: string } & NuevoRetiroDePropietario & { amount: CopAmount }] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const conSaldo = computed(() => props.saldos.filter(saldo => saldo.nature === 'payout'))
const opciones = computed(() => conSaldo.value.map(saldo => ({ label: saldo.propertyName, value: saldo.propertyId })))
const tiposDeCuenta = computed(() => ACCOUNT_KINDS.map(kind => ({ label: t(`ownerWallet.withdrawal.accountKinds.${kind}`), value: kind })))

const estado = reactive({
  propertyId: '',
  amount: null as number | string | null,
  bank: '',
  accountKind: 'savings' as AccountKind,
  accountNumber: '',
  holder: '',
})
const errores = ref<Record<string, string>>({})

const elegida = computed(() => conSaldo.value.find(saldo => saldo.propertyId === estado.propertyId) ?? null)
const abierta = computed(() => elegida.value !== null && hasOpenOwnerWithdrawal(props.solicitudes, elegida.value.propertyId))

/** El campo numérico puede entregar texto o número según el navegador; solo cuenta un entero. */
function importeDelCampo(valor: number | string | null): CopAmount | null {
  if (valor === null || valor === '') {
    return null
  }
  const numero = Number(valor)
  return esImporte(numero) ? pesos(numero) : null
}

const CAMPO_DE_CLAVE: Record<string, string> = {
  'ownerWallet.withdrawal.validation.amount_required': 'amount',
  'ownerWallet.withdrawal.validation.above_balance': 'amount',
  'ownerWallet.withdrawal.validation.open_request': 'amount',
  'ownerWallet.withdrawal.validation.bank_required': 'bank',
  'ownerWallet.withdrawal.validation.account_kind_required': 'accountKind',
  'ownerWallet.withdrawal.validation.account_required': 'accountNumber',
  'ownerWallet.withdrawal.validation.holder_required': 'holder',
}

function enviar() {
  if (!elegida.value) {
    errores.value = { propertyId: t('ownerWallet.withdrawal.propertyPlaceholder') }
    return
  }
  const monto = importeDelCampo(estado.amount)
  const datos: NuevoRetiroDePropietario = { amount: monto, bank: estado.bank, accountKind: estado.accountKind, accountNumber: estado.accountNumber, holder: estado.holder }
  const problemas = validateOwnerWithdrawal(datos, elegida.value.balance, props.solicitudes, elegida.value.propertyId)
  const nuevos: Record<string, string> = {}
  for (const problema of problemas) {
    nuevos[CAMPO_DE_CLAVE[problema] ?? 'amount'] ??= t(problema)
  }
  errores.value = nuevos
  if (problemas.length > 0 || monto === null) {
    return
  }
  emit('submit', { propertyId: elegida.value.propertyId, ...datos, amount: monto, bank: estado.bank.trim(), accountNumber: estado.accountNumber.trim(), holder: estado.holder.trim() })
}

function limpiar() {
  estado.amount = null
  errores.value = {}
}

defineExpose({ limpiar })
</script>

<template>
  <div
    class="space-y-4 rounded-2xl border border-default bg-default p-5"
    data-test="solicitud-de-retiro-propietario"
  >
    <div>
      <h3 class="font-display text-xl text-highlighted">
        {{ t('ownerWallet.withdrawal.title') }}
      </h3>
      <p class="mt-1 text-sm text-muted">
        {{ t('ownerWallet.withdrawal.hint') }}
      </p>
    </div>

    <p
      v-if="conSaldo.length === 0"
      class="text-sm text-muted"
      data-test="sin-saldo-para-retirar"
    >
      {{ t('ownerWallet.withdrawal.noBalance') }}
    </p>

    <UForm
      v-else
      :state="estado"
      class="space-y-4"
      data-test="formulario-retiro-propietario"
      @submit.prevent="enviar"
    >
      <UFormField
        :label="t('ownerWallet.withdrawal.property')"
        :error="errores.propertyId"
        :hint="elegida ? t('ownerWallet.withdrawal.available', { amount: formatearImporte(elegida.balance, idioma) }) : undefined"
        required
        data-test="campo-retiro-propiedad"
      >
        <USelect
          v-model="estado.propertyId"
          :items="opciones"
          :placeholder="t('ownerWallet.withdrawal.propertyPlaceholder')"
          class="w-full"
          data-test="retiro-propiedad"
        />
      </UFormField>

      <UAlert
        v-if="abierta"
        color="warning"
        variant="subtle"
        icon="i-lucide-hourglass"
        :title="t('ownerWallet.withdrawal.open', { property: elegida?.propertyName ?? '' })"
        data-test="retiro-abierto"
      />

      <template v-else-if="elegida">
        <UFormField
          :label="t('ownerWallet.withdrawal.amount')"
          :hint="t('ownerWallet.withdrawal.amountHint')"
          :error="errores.amount"
          required
          data-test="campo-monto-retiro"
        >
          <UInput
            v-model="estado.amount"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            class="w-full font-mono"
            data-test="retiro-monto"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('ownerWallet.withdrawal.bank')"
            :error="errores.bank"
            required
          >
            <UInput
              v-model="estado.bank"
              class="w-full"
              data-test="retiro-banco"
            />
          </UFormField>

          <UFormField
            :label="t('ownerWallet.withdrawal.accountKind')"
            :error="errores.accountKind"
            required
          >
            <USelect
              v-model="estado.accountKind"
              :items="tiposDeCuenta"
              class="w-full"
              data-test="retiro-tipo-cuenta"
            />
          </UFormField>

          <UFormField
            :label="t('ownerWallet.withdrawal.accountNumber')"
            :error="errores.accountNumber"
            required
          >
            <UInput
              v-model="estado.accountNumber"
              class="w-full font-mono"
              data-test="retiro-numero"
            />
          </UFormField>

          <UFormField
            :label="t('ownerWallet.withdrawal.holder')"
            :error="errores.holder"
            required
          >
            <UInput
              v-model="estado.holder"
              class="w-full"
              data-test="retiro-titular"
            />
          </UFormField>
        </div>

        <div class="flex justify-end">
          <UButton
            type="submit"
            icon="i-lucide-send"
            :loading="enviando"
            :label="t('ownerWallet.withdrawal.submit')"
            data-test="enviar-retiro"
          />
        </div>
      </template>
    </UForm>
  </div>
</template>
