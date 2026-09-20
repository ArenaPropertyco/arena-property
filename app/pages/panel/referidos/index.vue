<script setup lang="ts">
/**
 * HU-53 · RF-53.1…RF-53.5 · D-20 — el listado de referidos del Embajador.
 *
 * La página orquesta: monta los totalizadores, los filtros y el listado, que
 * llegan ya resueltos por `useReferidos` sobre las funciones puras de
 * `shared/referrals/listing`. Quién ve qué lo decidió la RLS de la vista: el
 * Embajador ve los suyos y el Superadmin todos (RF-53.5).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'ver_referidos' } })

const { t } = useI18n()
const { referidos, todos, totales, filtro, pendiente } = useReferidos()
</script>

<template>
  <PanelPage
    :titulo="t('referrals.list.title')"
    :subtitulo="t('referrals.list.subtitle')"
  >
    <p
      v-if="pendiente && todos.length === 0"
      class="text-sm text-muted"
      data-test="referidos-cargando"
    >
      {{ t('referrals.list.loading') }}
    </p>

    <p
      v-else-if="todos.length === 0"
      class="text-sm text-muted"
      data-test="sin-referidos-aun"
    >
      {{ t('referrals.list.empty') }}
    </p>

    <div
      v-else
      class="space-y-6"
    >
      <section class="space-y-4">
        <SectionHeading :titulo="t('referrals.list.totalsTitle')" />
        <ReferralTotals :totales="totales" />
      </section>

      <ReferralFilters v-model:filtro="filtro" />

      <ReferralsTable :referidos="referidos" />
    </div>
  </PanelPage>
</template>
