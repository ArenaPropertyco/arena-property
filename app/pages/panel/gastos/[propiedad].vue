<script setup lang="ts">
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import { puede } from '#shared/permissions/mapa'

/**
 * HU-23 · RF-23.2…RF-23.7 — los gastos comunes de una propiedad.
 *
 * La página orquesta: carga la maestra y los movimientos con sus cuotas ya
 * generadas por la base, monta los componentes y traduce cada resultado en un
 * aviso. Registrar y anular es del Administrador asignado y del Superadmin, que
 * alcanza todas las propiedades (`registrar_gastos` en la matriz de HU-07, D-40);
 * el Propietario entra en lectura y la RLS solo le entrega las cuotas de su fracción.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'ver_finanzas' } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const localePath = useLocalePath()
const { roles } = useCuenta()

const propiedadId = computed(() => String(ruta.params.propiedad ?? ''))

const { maestra } = useMaestraContable()
const { propiedad, movimientos, cuotasDe, pendiente, registrar, anular } = useMovimientos(propiedadId)

const puedeRegistrar = computed(() => puede(roles.value, 'registrar_gastos', { escritura: true }))

const registrando = ref(false)
const viendoCuotas = ref<string | null>(null)
const anulando = ref<string | null>(null)
const ocupado = ref(false)

const cuotasVisibles = computed(() => viendoCuotas.value ? cuotasDe(viendoCuotas.value) : [])

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

/** RF-23.3 · tras guardar se enseñan las 8 cuotas que la base acaba de generar. */
async function guardarGasto(nuevo: NuevoMovimiento) {
  ocupado.value = true
  const resultado = await registrar(nuevo)
  ocupado.value = false

  toast.add(resultado.ok
    ? { title: t('finance.messages.registered'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  if (resultado.ok) {
    registrando.value = false
    viendoCuotas.value = resultado.id ?? null
  }
}

async function confirmarAnulacion(motivo: string) {
  const movimiento = anulando.value
  if (!movimiento) {
    return
  }
  if (await ejecutar(() => anular(movimiento, motivo), 'finance.messages.voided')) {
    anulando.value = null
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('finance.title')"
    :subtitulo="propiedad?.name ?? undefined"
  >
    <p
      v-if="!pendiente && !propiedad"
      class="text-sm text-muted"
      data-test="propiedad-no-encontrada"
    >
      {{ t('finance.notFound') }}
    </p>

    <div
      v-else-if="propiedad"
      class="space-y-8"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          v-if="puedeRegistrar"
          variant="link"
          size="sm"
          icon="i-lucide-arrow-left"
          :to="localePath(`/panel/propiedades/${propiedad.id}`)"
          :label="propiedad.name"
          data-test="volver-a-propiedad"
        />
        <p
          v-else
          class="text-sm text-muted"
          data-test="solo-lectura"
        >
          {{ t('finance.readOnly') }}
        </p>

        <UButton
          v-if="puedeRegistrar"
          size="sm"
          icon="i-lucide-plus"
          :label="t('finance.register')"
          data-test="registrar-gasto"
          @click="registrando = true"
        />
      </div>

      <section class="space-y-4">
        <SectionHeading :titulo="t('finance.subtitle')" />
        <MovementsTable
          :movimientos="movimientos"
          :puede-gestionar="puedeRegistrar"
          @ver-cuotas="viendoCuotas = $event"
          @anular="anulando = $event"
        />
      </section>
    </div>

    <USlideover
      v-model:open="registrando"
      :title="t('finance.registerTitle')"
    >
      <template #body>
        <MovementForm
          v-if="registrando"
          :property-id="propiedadId"
          :maestra="maestra"
          :enviando="ocupado"
          @submit="guardarGasto"
        />
      </template>
    </USlideover>

    <UModal
      :open="viendoCuotas !== null"
      :title="t('finance.shares.title')"
      :description="t('finance.shares.subtitle')"
      @update:open="viendoCuotas = null"
    >
      <template #body>
        <MovementSharesTable :cuotas="cuotasVisibles" />
      </template>
    </UModal>

    <UModal
      :open="anulando !== null"
      :title="t('finance.voidTitle')"
      @update:open="anulando = null"
    >
      <template #body>
        <ReasonForm
          :descripcion="t('finance.voidHint')"
          :etiqueta="t('finance.confirmVoid')"
          :enviando="ocupado"
          @submit="confirmarAnulacion"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
