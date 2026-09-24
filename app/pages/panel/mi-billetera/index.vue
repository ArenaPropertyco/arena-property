<script setup lang="ts">
import { formatearMes } from '#shared/dates/formato'
import type { OwnerChargeListed } from '#shared/finance/vistas'
import type { Idioma } from '#shared/money/formato'
import type { ReporteDePago } from '~/composables/useBilleteraDePropietario'

/**
 * HU-62 · RF-62.1…RF-62.14 · D-51 — la billetera del Propietario.
 *
 * La página orquesta: pide la billetera al composable y monta el saldo de cada
 * propiedad, los cobros con el diálogo para reportar un pago, la solicitud de
 * retiro con su historial, los cortes mensuales y el histórico de movimientos
 * con sus filtros. Quién ve qué lo decidió la RLS (RF-62.12): aquí solo entra
 * el Propietario y solo ve lo suyo.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t, locale } = useI18n()
const toast = useToast()
const {
  propiedades, saldos, consolidado, estimados, mesEnCurso, movimientos, cortes, cobros, retiros, comprobantes,
  filtro, pendiente, reportarPago, solicitarRetiro,
} = useBilleteraDePropietario()
const { maestra } = useMaestraContable()

const idioma = computed(() => locale.value as Idioma)

const reportando = ref<OwnerChargeListed | null>(null)
const enviandoPago = ref(false)
const enviandoRetiro = ref(false)
const formularioDeRetiro = useTemplateRef('formularioDeRetiro')

function avisar(resultado: { ok: true } | { ok: false, clave: string }, exito: string) {
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}

async function enviarPago(reporte: ReporteDePago) {
  if (!reportando.value) {
    return
  }
  enviandoPago.value = true
  const resultado = await reportarPago(reportando.value, reporte)
  enviandoPago.value = false
  avisar(resultado, 'ownerWallet.payment.sent')
  if (resultado.ok) {
    reportando.value = null
  }
}

async function enviarRetiro(retiro: Parameters<typeof solicitarRetiro>[1] & { propertyId: string }) {
  enviandoRetiro.value = true
  const resultado = await solicitarRetiro(retiro.propertyId, retiro)
  enviandoRetiro.value = false
  avisar(resultado, 'ownerWallet.withdrawal.sent')
  if (resultado.ok) {
    formularioDeRetiro.value?.limpiar()
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('ownerWallet.title')"
    :subtitulo="t('ownerWallet.subtitle')"
  >
    <p
      v-if="pendiente && propiedades.length === 0"
      class="text-sm text-muted"
      data-test="billetera-propietario-cargando"
    >
      {{ t('ownerWallet.loading') }}
    </p>

    <p
      v-else-if="propiedades.length === 0"
      class="text-sm text-muted"
      data-test="billetera-propietario-vacia"
    >
      {{ t('ownerWallet.empty') }}
    </p>

    <div
      v-else
      class="space-y-8"
    >
      <section class="space-y-4">
        <SectionHeading :titulo="t('ownerWallet.balances.title')" />
        <OwnerWalletBalances
          :saldos="saldos"
          :consolidado="consolidado"
          :estimados="estimados"
          :mes-en-curso="mesEnCurso"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('ownerWallet.charges.title')" />
        <p class="text-sm text-muted">
          {{ t('ownerWallet.charges.hint') }}
        </p>
        <OwnerChargesTable
          :cobros="cobros"
          :comprobantes="comprobantes"
          @reportar="reportando = $event"
        />
      </section>

      <OwnerWithdrawalForm
        ref="formularioDeRetiro"
        :saldos="saldos"
        :solicitudes="retiros"
        :enviando="enviandoRetiro"
        @submit="enviarRetiro"
      />

      <section
        v-if="retiros.length > 0"
        class="space-y-4"
      >
        <SectionHeading :titulo="t('ownerWallet.withdrawal.requestsTitle')" />
        <OwnerWithdrawalsTable
          :solicitudes="retiros"
          :comprobantes="comprobantes"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('ownerWallet.statements.title')" />
        <p class="text-sm text-muted">
          {{ t('ownerWallet.statements.hint') }}
        </p>
        <OwnerWalletFilters
          v-model:filtro="filtro"
          :propiedades="propiedades"
        />
        <OwnerStatementsTable :cortes="cortes" />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('ownerWallet.movements.title')" />
        <OwnerWalletMovementsTable :movimientos="movimientos" />
      </section>
    </div>

    <UModal
      :open="reportando !== null"
      :title="reportando ? t('ownerWallet.payment.title', { property: reportando.propertyName, period: formatearMes(reportando.period, idioma) }) : ''"
      @update:open="(abierto: boolean) => { if (!abierto) reportando = null }"
    >
      <template #body>
        <OwnerPaymentForm
          v-if="reportando"
          :cobro="reportando"
          :medios="maestra.medios"
          :enviando="enviandoPago"
          @submit="enviarPago"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
