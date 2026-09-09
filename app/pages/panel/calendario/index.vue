<script setup lang="ts">
/**
 * HU-12 · RF-12.2, RF-12.3, RF-12.7, RF-12.9 — configuración del calendario.
 *
 * La página orquesta: elige propiedad y año, deja al Administrador clasificar la
 * rejilla, muestra el reparto que el motor calcula al vuelo y publica. Con
 * estadías existentes pide confirmación y lista los conflictos (T-109).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'gestionar_calendario' } })

const { t } = useI18n()
const toast = useToast()
const { propiedades: todas } = usePropiedades()

const propiedades = computed(() => todas.value
  .filter(propiedad => propiedad.fractionCount === 8)
  .map(propiedad => ({ id: propiedad.id, label: propiedad.name })))

const propertyId = ref<string | null>(null)
watch(propiedades, (lista) => {
  if (!propertyId.value && lista[0]) {
    propertyId.value = lista[0].id
  }
}, { immediate: true })

const anio = ref(new Date().getFullYear() + 1)

const {
  rejilla, fechasEspeciales, clasificacion, anioBase, reparto, errorDeReparto, conflictos, estadias, publicadoEl, pendiente, guardar, publicar,
} = useCalendario(propertyId, anio)

const ocupado = ref(false)
const confirmando = ref(false)

async function guardarClasificacion() {
  ocupado.value = true
  const resultado = await guardar()
  ocupado.value = false
  toast.add(resultado.ok ? { title: t('calendar.saved'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function publicarReparto(confirmar = false) {
  ocupado.value = true
  const resultado = await publicar(confirmar)
  ocupado.value = false

  if (!resultado.ok && resultado.requiereConfirmacion) {
    confirmando.value = true
    return
  }
  confirmando.value = false
  toast.add(resultado.ok ? { title: t('calendar.published'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('calendar.title')"
    :subtitulo="t('calendar.subtitle')"
  >
    <p
      v-if="propiedades.length === 0"
      class="text-sm text-muted"
      data-test="sin-propiedades"
    >
      {{ t('calendar.noProperties') }}
    </p>

    <div
      v-else
      class="space-y-8"
    >
      <CalendarPicker
        v-model:property-id="propertyId"
        v-model:anio="anio"
        :propiedades="propiedades"
      />

      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionHeading :titulo="t('calendar.grid', { year: anio })" />
            <p class="text-sm text-muted">
              {{ t('calendar.gridHint', { weeks: rejilla.length, special: fechasEspeciales.length }) }}
            </p>
          </div>
          <CalendarStatus :publicado-el="publicadoEl" />
        </div>

        <SeasonClassifier
          v-model:clasificacion="clasificacion"
          :rejilla="rejilla"
          :anio="anio"
          :editable="!pendiente"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('calendar.preview')" />
        <p class="text-sm text-muted">
          {{ t('calendar.previewHint', { base: anioBase }) }}
        </p>
        <AllocationPreview
          :reparto="reparto"
          :error="errorDeReparto"
          :rejilla="rejilla"
        />
      </section>

      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          variant="outline"
          :loading="ocupado"
          :label="t('calendar.save')"
          data-test="guardar-calendario"
          @click="guardarClasificacion"
        />
        <UButton
          :disabled="!reparto"
          :loading="ocupado"
          icon="i-lucide-calendar-check"
          :label="publicadoEl ? t('calendar.republish') : t('calendar.publish')"
          data-test="publicar-calendario"
          @click="publicarReparto(false)"
        />
      </div>
    </div>

    <UModal
      v-model:open="confirmando"
      :title="t('calendar.confirmTitle')"
    >
      <template #body>
        <ReconfigurationConfirm
          :estadias="estadias"
          :conflictos="conflictos"
          :enviando="ocupado"
          @confirmar="publicarReparto(true)"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
