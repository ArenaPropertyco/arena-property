<script setup lang="ts">
import type { FilaDelTablero, PagoDelTablero } from '#shared/finance/tablero-de-cobros'

/**
 * HU-63 · RF-63.1…RF-63.7, RF-63.9…RF-63.11 — el tablero de cobros de una
 * propiedad.
 *
 * La página orquesta: elige el mes, muestra el resumen y las 8 filas, y lleva
 * a la base cada decisión. Confirmar abre un diálogo que repite el pago
 * (RF-63.5); rechazar pide motivo; pagar un retiro pide el comprobante. La
 * base vuelve a comprobar permiso y estado en cada una, así que dos clics no
 * confirman dos veces. Quién ve qué lo decidió la RLS (RF-63.8).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'confirmar_pagos_de_propietarios' } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()

const propiedadId = computed(() => String(ruta.params.propiedad ?? ''))
const { propiedad, mes, mesEnCurso, estimado, filtro, filas, resumen, comprobantes, pendiente, confirmar, rechazar, pagar } = useTableroDeCobros(propiedadId)

const ocupada = ref<string | null>(null)
const confirmando = ref<{ pago: PagoDelTablero, fila: FilaDelTablero } | null>(null)
const rechazando = ref<{ pago: PagoDelTablero, fila: FilaDelTablero } | null>(null)
const pagando = ref<FilaDelTablero | null>(null)

function avisar(resultado: { ok: true } | { ok: false, clave: string }, exito: string) {
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}

async function confirmarPago(pago: PagoDelTablero) {
  if (ocupada.value) {
    return
  }
  ocupada.value = pago.id
  const resultado = await confirmar(pago)
  ocupada.value = null
  avisar(resultado, 'collections.confirm.done')
  if (resultado.ok) {
    confirmando.value = null
  }
}

async function rechazarPago(motivo: string) {
  if (!rechazando.value || ocupada.value) {
    return
  }
  ocupada.value = rechazando.value.pago.id
  const resultado = await rechazar(rechazando.value.pago, motivo)
  ocupada.value = null
  avisar(resultado, 'collections.reject.done')
  if (resultado.ok) {
    rechazando.value = null
  }
}

async function pagarRetiro(archivo: File) {
  if (!pagando.value?.withdrawal || ocupada.value) {
    return
  }
  ocupada.value = pagando.value.withdrawal.id
  const resultado = await pagar(pagando.value, archivo)
  ocupada.value = null
  avisar(resultado, 'collections.pay.done')
  if (resultado.ok) {
    pagando.value = null
  }
}
</script>

<template>
  <PanelPage
    :titulo="propiedad ? t('collections.boardOf', { property: propiedad.name }) : t('collections.title')"
    :subtitulo="t('collections.subtitle')"
  >
    <p
      v-if="pendiente && !propiedad"
      class="text-sm text-muted"
      data-test="tablero-cargando"
    >
      {{ t('collections.loading') }}
    </p>

    <p
      v-else-if="!propiedad"
      class="text-sm text-muted"
      data-test="tablero-no-encontrado"
    >
      {{ t('collections.notFound') }}
    </p>

    <div
      v-else
      class="space-y-8"
    >
      <CollectionsBoardFilters
        v-model:filtro="filtro"
        v-model:mes="mes"
        :mes-en-curso="mesEnCurso"
      />

      <section class="space-y-4">
        <SectionHeading :titulo="t('collections.summary.title')" />
        <CollectionsSummary
          :resumen="resumen"
          :estimado="estimado"
        />
      </section>

      <CollectionsBoardTable
        :filas="filas"
        :comprobantes="comprobantes"
        :ocupada="ocupada"
        @confirmar="(pago, fila) => confirmando = { pago, fila }"
        @rechazar="(pago, fila) => rechazando = { pago, fila }"
        @pagar="pagando = $event"
      />
    </div>

    <UModal
      :open="confirmando !== null"
      :title="confirmando ? t('collections.confirm.title', { name: confirmando.fila.ownerLabel ?? '' }) : ''"
      @update:open="(abierto: boolean) => { if (!abierto) confirmando = null }"
    >
      <template #body>
        <OwnerPaymentConfirmForm
          v-if="confirmando"
          :pago="confirmando.pago"
          :fila="confirmando.fila"
          :enviando="ocupada === confirmando.pago.id"
          @submit="confirmarPago"
        />
      </template>
    </UModal>

    <UModal
      :open="rechazando !== null"
      :title="rechazando ? t('collections.reject.title', { name: rechazando.fila.ownerLabel ?? '' }) : ''"
      @update:open="(abierto: boolean) => { if (!abierto) rechazando = null }"
    >
      <template #body>
        <ReasonForm
          v-if="rechazando"
          :descripcion="t('collections.reject.hint')"
          :etiqueta="t('collections.reject.submit')"
          :enviando="ocupada === rechazando.pago.id"
          @submit="rechazarPago"
        />
      </template>
    </UModal>

    <UModal
      :open="pagando !== null"
      :title="pagando ? t('collections.pay.title', { name: pagando.ownerLabel ?? '' }) : ''"
      @update:open="(abierto: boolean) => { if (!abierto) pagando = null }"
    >
      <template #body>
        <OwnerPayoutForm
          v-if="pagando"
          :fila="pagando"
          :enviando="ocupada === pagando.withdrawal?.id"
          @submit="pagarRetiro"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
