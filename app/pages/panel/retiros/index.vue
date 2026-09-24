<script setup lang="ts">
import type { CopAmount } from '#shared/money/importe'
import type { WithdrawalListed } from '#shared/referrals/views'

/**
 * HU-56 · RF-56.1…RF-56.6 · D-06 · D-20 — la bandeja de retiros del Superadmin.
 *
 * La página orquesta: fija el mínimo, lista las solicitudes con los saldos de
 * cada Embajador y lleva a la base la decisión sobre cada una. Rechazar y pagar
 * abren un diálogo con su formulario; aprobar es un clic, porque la base vuelve
 * a comprobar el disponible antes de descontarlo (RF-56.3).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'aprobar_pagos_comision' } })

const { t } = useI18n()
const toast = useToast()
const { solicitudes, comprobantes, minimo, pendiente, aprobar, rechazar, pagar, fijarMinimo } = useRetiros()

const ocupada = ref<string | null>(null)
const guardandoMinimo = ref(false)
const rechazando = ref<WithdrawalListed | null>(null)
const pagando = ref<WithdrawalListed | null>(null)

function avisar(resultado: { ok: true } | { ok: false, clave: string }, exito: string) {
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}

async function aprobarRetiro(solicitud: WithdrawalListed) {
  ocupada.value = solicitud.id
  const resultado = await aprobar(solicitud.id)
  ocupada.value = null
  avisar(resultado, 'withdrawals.done.approved')
}

async function confirmarRechazo(motivo: string) {
  if (!rechazando.value) {
    return
  }
  ocupada.value = rechazando.value.id
  const resultado = await rechazar(rechazando.value.id, motivo)
  ocupada.value = null
  avisar(resultado, 'withdrawals.done.rejected')
  if (resultado.ok) {
    rechazando.value = null
  }
}

async function confirmarPago(archivo: File) {
  if (!pagando.value) {
    return
  }
  ocupada.value = pagando.value.id
  const resultado = await pagar(pagando.value, archivo)
  ocupada.value = null
  avisar(resultado, 'withdrawals.done.paid')
  if (resultado.ok) {
    pagando.value = null
  }
}

async function guardarMinimo(monto: CopAmount) {
  guardandoMinimo.value = true
  const resultado = await fijarMinimo(monto)
  guardandoMinimo.value = false
  avisar(resultado, 'withdrawals.minimum.saved')
}
</script>

<template>
  <PanelPage
    :titulo="t('withdrawals.title')"
    :subtitulo="t('withdrawals.subtitle')"
  >
    <div class="space-y-8">
      <WithdrawalMinimumForm
        :minimo="minimo"
        :enviando="guardandoMinimo"
        @submit="guardarMinimo"
      />

      <p
        v-if="pendiente && solicitudes.length === 0"
        class="text-sm text-muted"
        data-test="retiros-cargando"
      >
        {{ t('withdrawals.loading') }}
      </p>

      <WithdrawalRequestsTable
        v-else
        :solicitudes="solicitudes"
        modo="superadmin"
        :ocupada="ocupada"
        :comprobantes="comprobantes"
        @aprobar="aprobarRetiro"
        @rechazar="rechazando = $event"
        @pagar="pagando = $event"
      />
    </div>

    <UModal
      :open="rechazando !== null"
      :title="rechazando ? t('withdrawals.reject.title', { name: rechazando.ambassadorName ?? rechazando.ambassadorEmail }) : ''"
      @update:open="(abierto: boolean) => { if (!abierto) rechazando = null }"
    >
      <template #body>
        <WithdrawalRejectForm
          v-if="rechazando"
          :solicitud="rechazando"
          :enviando="ocupada === rechazando.id"
          @submit="confirmarRechazo"
        />
      </template>
    </UModal>

    <UModal
      :open="pagando !== null"
      :title="pagando ? t('withdrawals.pay.title', { name: pagando.ambassadorName ?? pagando.ambassadorEmail }) : ''"
      @update:open="(abierto: boolean) => { if (!abierto) pagando = null }"
    >
      <template #body>
        <WithdrawalPayForm
          v-if="pagando"
          :solicitud="pagando"
          :enviando="ocupada === pagando.id"
          @submit="confirmarPago"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
