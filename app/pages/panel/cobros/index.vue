<script setup lang="ts">
import { formatearMes } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-63 · RF-63.8 · CA-63.13 — la vista global de cobros.
 *
 * La página orquesta: pide a `useCobrosGlobales` una fila por propiedad
 * gestionada, con el resumen del último mes cerrado, y la lista con el enlace
 * al tablero de cada una. El Superadmin ve todas las propiedades; el
 * Administrador, las suyas.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'confirmar_pagos_de_propietarios' } })

const { t, locale } = useI18n()
const { mes, filas, pendiente } = useCobrosGlobales()

const idioma = computed(() => locale.value as Idioma)
</script>

<template>
  <PanelPage
    :titulo="t('collections.globalTitle')"
    :subtitulo="t('collections.globalSubtitle')"
  >
    <div class="space-y-4">
      <SectionHeading :titulo="formatearMes(mes, idioma)" />
      <p
        v-if="pendiente && filas.length === 0"
        class="text-sm text-muted"
        data-test="cobros-cargando"
      >
        {{ t('collections.loading') }}
      </p>
      <CollectionsOverviewTable
        v-else
        :filas="filas"
      />
    </div>
  </PanelPage>
</template>
