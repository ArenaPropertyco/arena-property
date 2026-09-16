<script setup lang="ts">
/**
 * Panel de entrada. Exige sesión verificada (RF-04.2).
 *
 * HU-18 · RF-18.1…RF-18.5 · el Propietario ve su portafolio: una tarjeta por
 * fracción con su próxima estadía, su saldo del periodo, lo que produjo la renta a
 * terceros, el plan de pagos mientras no esté completo (HU-58 · RF-58.9) y sus
 * copropietarios.
 *
 * HU-21 · RF-21.1…RF-21.3 · quien administra propiedades ve un resumen de cada una
 * —ocupación, próximas reservas y alertas— y, aparte, las semanas de la bolsa que
 * siguen sin tercero (RF-21.1b · D-43). El aviso de liberación llega una sola vez
 * (TR-03); esa alerta es lo que queda si se pasó por alto.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const { roles } = useCuenta()
const { tarjetas, pendiente: cargandoPortafolio } = usePortafolio()

const esPropietario = computed(() => roles.value.includes('owner'))
const gestiona = computed(() => roles.value.includes('property_admin') || roles.value.includes('superadmin'))

const { semanas: porColocar } = useSemanasPorColocar()
const { resumenes, pendiente: cargandoTablero } = useTablero()
</script>

<template>
  <PanelPage :titulo="t('nav.dashboard')">
    <section
      v-if="gestiona"
      class="space-y-4"
      data-test="seccion-tablero"
    >
      <SectionHeading :titulo="t('dashboard.title')" />
      <p class="text-sm text-muted">
        {{ t('dashboard.subtitle') }}
      </p>
      <PropertySummaryList
        :resumenes="resumenes"
        :pendiente="cargandoTablero"
      />
    </section>

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
      <SectionHeading :titulo="t('portfolio.title')" />
      <p class="text-sm text-muted">
        {{ t('portfolio.subtitle') }}
      </p>
      <OwnerFractionsList
        :tarjetas="tarjetas"
        :pendiente="cargandoPortafolio"
      />
    </section>
  </PanelPage>
</template>
