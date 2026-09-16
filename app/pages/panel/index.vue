<script setup lang="ts">
/**
 * Panel de entrada. El dashboard completo es HU-18; desde ya, el Propietario ve
 * sus planes de pago en lectura (HU-58 · RF-58.9): saldo pendiente y qué falta
 * para activar el calendario de cada fracción. Exige sesión verificada (RF-04.2).
 *
 * HU-21 · RF-21.1b · D-43 · quien administra propiedades ve además las semanas de
 * la bolsa que siguen sin tercero. El aviso de liberación llega una sola vez (TR-03);
 * esto es lo que queda si se pasó por alto.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const { roles } = useCuenta()
const { planes, pendiente } = usePlanesPropios()

const esPropietario = computed(() => roles.value.includes('owner'))
const gestiona = computed(() => roles.value.includes('property_admin') || roles.value.includes('superadmin'))

const { semanas: porColocar } = useSemanasPorColocar()
</script>

<template>
  <PanelPage :titulo="t('nav.dashboard')">
    <section
      v-if="gestiona"
      class="space-y-4"
      data-test="seccion-por-colocar"
    >
      <SectionHeading :titulo="t('rentals.pool.alertTitle')" />
      <RentalPoolAlert :semanas="porColocar" />
    </section>

    <section
      v-if="esPropietario"
      class="space-y-4"
    >
      <SectionHeading :titulo="t('owner.title')" />
      <p class="text-sm text-muted">
        {{ t('owner.subtitle') }}
      </p>
      <OwnerPlansList
        :planes="planes"
        :pendiente="pendiente"
      />
    </section>
  </PanelPage>
</template>
