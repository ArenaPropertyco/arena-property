<script setup lang="ts">
import { puede } from '#shared/permissions/mapa'
import type { AbonoConArchivo } from '~/composables/usePlanDePagos'

/**
 * HU-58 · RF-58.2…RF-58.8 — el plan de pagos de una fracción vendida.
 *
 * La página orquesta: carga el plan ya derivado por la base, monta los componentes
 * y traduce cada resultado en un aviso. Registrar un abono es del Administrador de
 * la propiedad; anular la compra, del Superadmin (RF-58.8). El Propietario entra
 * en lectura (RF-58.9): la RLS solo le entrega su propio plan y la página no le
 * ofrece acciones.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const localePath = useLocalePath()
const { roles } = useCuenta()

const planId = computed(() => String(ruta.params.plan ?? ''))

const { plan, abonos, pendiente, registrarAbono, anularAbono, anularCompra } = usePlanDePagos(planId)

const esSuperadmin = computed(() => roles.value.includes('superadmin'))
const puedeGestionar = computed(() => puede(roles.value, 'gestionar_propiedades', { escritura: true }))

const abierto = computed(() => plan.value !== null && plan.value.status !== 'voided')
const admiteAbonos = computed(() => plan.value !== null
  && (plan.value.status === 'reserved' || plan.value.status === 'in_progress'))

const registrando = ref(false)
const anulandoAbono = ref<string | null>(null)
const anulandoCompra = ref(false)
const ocupado = ref(false)

async function ejecutar(
  operacion: () => Promise<{ ok: true } | { ok: false, clave: string }>,
  exito: string,
) {
  ocupado.value = true
  const resultado = await operacion()
  ocupado.value = false

  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  return resultado.ok
}

async function guardarAbono(datos: AbonoConArchivo) {
  if (await ejecutar(() => registrarAbono(datos), 'payments.messages.registered')) {
    registrando.value = false
  }
}

async function confirmarAnulacionDeAbono(motivo: string) {
  const abono = anulandoAbono.value
  if (!abono) {
    return
  }
  if (await ejecutar(() => anularAbono(abono, motivo), 'payments.messages.voided')) {
    anulandoAbono.value = null
  }
}

async function confirmarAnulacionDeCompra(motivo: string) {
  if (await ejecutar(() => anularCompra(motivo), 'payments.messages.purchaseVoided')) {
    anulandoCompra.value = false
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('payments.title')"
    :subtitulo="plan ? t('payments.fractionOf', { number: plan.fractionNumber, property: plan.propertyName }) : undefined"
  >
    <p
      v-if="!pendiente && !plan"
      class="text-sm text-muted"
      data-test="plan-no-encontrado"
    >
      {{ t('payments.notFound') }}
    </p>

    <div
      v-else-if="plan"
      class="space-y-10"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          v-if="puedeGestionar"
          variant="link"
          size="sm"
          icon="i-lucide-arrow-left"
          :to="localePath(`/panel/propiedades/${plan.propertyId}`)"
          :label="plan.propertyName"
          data-test="volver-a-propiedad"
        />
        <UButton
          v-else
          variant="link"
          size="sm"
          icon="i-lucide-arrow-left"
          :to="localePath('/panel')"
          :label="t('owner.title')"
          data-test="volver-al-panel"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="puedeGestionar && admiteAbonos"
            size="sm"
            icon="i-lucide-plus"
            :label="t('payments.register')"
            data-test="registrar-abono"
            @click="registrando = true"
          />
          <UButton
            v-if="esSuperadmin && abierto"
            variant="outline"
            color="error"
            size="sm"
            icon="i-lucide-ban"
            :label="t('payments.voidPurchase')"
            data-test="anular-compra"
            @click="anulandoCompra = true"
          />
        </div>
      </div>

      <PaymentPlanSummary :plan="plan" />

      <section class="space-y-4">
        <SectionHeading :titulo="t('payments.subtitle')" />
        <PaymentsTable
          :abonos="abonos"
          :puede-gestionar="puedeGestionar"
          :abierto="abierto"
          @anular="anulandoAbono = $event"
        />
      </section>
    </div>

    <UModal
      v-model:open="registrando"
      :title="t('payments.register')"
    >
      <template #body>
        <PaymentForm
          v-if="plan"
          :plan="plan"
          :enviando="ocupado"
          @submit="guardarAbono"
        />
      </template>
    </UModal>

    <UModal
      :open="anulandoAbono !== null"
      :title="t('payments.voidTitle')"
      @update:open="anulandoAbono = null"
    >
      <template #body>
        <ReasonForm
          :descripcion="t('payments.voidHint')"
          :etiqueta="t('payments.confirmVoid')"
          :enviando="ocupado"
          @submit="confirmarAnulacionDeAbono"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="anulandoCompra"
      :title="t('payments.voidPurchaseTitle')"
    >
      <template #body>
        <ReasonForm
          :descripcion="t('payments.voidPurchaseHint')"
          :etiqueta="t('payments.voidPurchase')"
          :enviando="ocupado"
          @submit="confirmarAnulacionDeCompra"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
