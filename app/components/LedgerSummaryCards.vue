<script setup lang="ts">
import type { ReporteFinanciero, Totales } from '#shared/finance/reportes'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-25 · RF-25.3 · D-01 — los dos libros y el consolidado.
 *
 * El libro de propiedad y el de plataforma se presentan por separado, y el
 * consolidado solo existe a nivel de negocio: la comisión de un Embajador es
 * costo de Arena y nunca aparece como gasto de un inmueble. Las cifras llegan
 * sumadas por el dominio; aquí solo se formatean con TR-02.
 */
defineProps<{ reporte: ReporteFinanciero }>()

const { t, locale } = useI18n()

function importe(monto: Totales['neto']): string {
  return formatearImporte(monto, locale.value as Idioma)
}

const bloques = [
  { clave: 'propiedad', marca: 'libro-propiedad', titulo: 'reports.propertyBook', icono: 'i-lucide-building-2' },
  { clave: 'plataforma', marca: 'libro-plataforma', titulo: 'reports.platformBook', icono: 'i-lucide-landmark' },
  { clave: 'consolidado', marca: 'consolidado', titulo: 'reports.consolidated', icono: 'i-lucide-sigma' },
] as const
</script>

<template>
  <div class="grid gap-4 md:grid-cols-3">
    <div
      v-for="bloque in bloques"
      :key="bloque.clave"
      class="space-y-3 rounded-2xl border border-default bg-default p-5"
      :data-test="bloque.marca"
    >
      <div class="flex items-center gap-2">
        <UIcon
          :name="bloque.icono"
          class="size-5 text-primary"
        />
        <h3 class="font-display text-xl text-highlighted">
          {{ t(bloque.titulo) }}
        </h3>
      </div>
      <dl class="space-y-2 text-sm">
        <div class="flex items-center justify-between gap-3">
          <dt class="text-muted">
            {{ t('reports.income') }}
          </dt>
          <dd
            class="font-mono text-highlighted"
            data-test="ingresos"
          >
            {{ importe(reporte[bloque.clave].ingresos) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-muted">
            {{ t('reports.expenses') }}
          </dt>
          <dd
            class="font-mono text-highlighted"
            data-test="egresos"
          >
            {{ importe(reporte[bloque.clave].egresos) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3 border-t border-default pt-2">
          <dt class="font-medium text-highlighted">
            {{ t('reports.net') }}
          </dt>
          <dd
            class="font-mono font-medium"
            :class="reporte[bloque.clave].neto < 0 ? 'text-error' : 'text-highlighted'"
            data-test="neto"
          >
            {{ importe(reporte[bloque.clave].neto) }}
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
