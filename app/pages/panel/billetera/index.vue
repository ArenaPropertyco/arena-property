<script setup lang="ts">
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-55 · RF-55.1…RF-55.5 · HU-56 · RF-56.1 · D-02 · D-06 — la billetera del
 * Embajador.
 *
 * La página orquesta: pide la billetera al composable y monta los cuatro
 * saldos, la solicitud de retiro, el historial de solicitudes y el histórico de
 * movimientos con sus filtros. Quién ve qué lo decidió la RLS (RF-55.4): aquí
 * solo entra el Embajador y solo ve lo suyo.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'ver_saldo_y_retirar' } })

const { t } = useI18n()
const toast = useToast()
const { embajador, saldos, movimientos, todos, filtro, solicitudes, comprobantes, minimo, pendiente, solicitar } = useBilletera()

const formulario = useTemplateRef('formulario')
const enviando = ref(false)

async function solicitarRetiro(monto: CopAmount) {
  enviando.value = true
  const resultado = await solicitar(monto)
  enviando.value = false
  toast.add(resultado.ok
    ? { title: t('wallet.withdrawal.sent'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
  if (resultado.ok) {
    formulario.value?.limpiar()
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('wallet.title')"
    :subtitulo="t('wallet.subtitle')"
  >
    <p
      v-if="pendiente && !embajador"
      class="text-sm text-muted"
      data-test="billetera-cargando"
    >
      {{ t('wallet.loading') }}
    </p>

    <p
      v-else-if="!embajador || embajador.status !== 'approved'"
      class="text-sm text-muted"
      data-test="billetera-sin-embajador"
    >
      {{ t('wallet.notAmbassador') }}
    </p>

    <div
      v-else
      class="space-y-8"
    >
      <WalletBalances :balances="saldos" />

      <WithdrawalRequestForm
        ref="formulario"
        :disponible="saldos.available"
        :minimo="minimo"
        :solicitudes="solicitudes"
        :enviando="enviando"
        @submit="solicitarRetiro"
      />

      <section
        v-if="solicitudes.length > 0"
        class="space-y-4"
      >
        <SectionHeading :titulo="t('wallet.withdrawal.requestsTitle')" />
        <WithdrawalRequestsTable
          :solicitudes="solicitudes"
          modo="embajador"
          :comprobantes="comprobantes"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('wallet.movements.title')" />
        <template v-if="todos.length > 0">
          <WalletFilters v-model:filtro="filtro" />
          <WalletMovementsTable :movimientos="movimientos" />
        </template>
        <p
          v-else
          class="text-sm text-muted"
          data-test="billetera-sin-movimientos"
        >
          {{ t('wallet.movements.empty') }}
        </p>
      </section>
    </div>
  </PanelPage>
</template>
