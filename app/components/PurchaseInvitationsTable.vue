<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { EstadoDeInvitacion } from '#shared/purchases/invitaciones'
import type { InvitacionListada } from '#shared/purchases/vistas'

/**
 * HU-06 · RF-06.1, RF-06.2 — las invitaciones de compra de una propiedad.
 *
 * «Registrar venta» solo se ofrece cuando el invitado ya tiene cuenta: sin ella no
 * hay a quién dar la titularidad, y la base lo rechazaría. La tabla presenta y
 * emite; qué pasa después lo decide la página.
 */
const props = defineProps<{
  invitaciones: InvitacionListada[]
  puedeGestionar: boolean
  ocupado: boolean
}>()

defineEmits<{
  cerrar: [string]
  cancelar: [string]
}>()

const { t, locale } = useI18n()

const COLOR_DE_ESTADO: Record<EstadoDeInvitacion, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  accepted: 'success',
  cancelled: 'neutral',
}

function precio(invitacion: InvitacionListada): string {
  return formatearImporte(invitacion.agreedPrice, locale.value as Idioma)
}

function puedeCerrar(invitacion: InvitacionListada): boolean {
  return props.puedeGestionar && invitacion.status === 'pending' && invitacion.inviteeId !== null
}

const columnas = computed<TableColumn<InvitacionListada>[]>(() => [
  { id: 'fraccion', header: t('purchases.fraction') },
  { id: 'invitado', header: t('purchases.invitee') },
  { id: 'precio', header: t('purchases.agreedPrice') },
  { id: 'estado', header: t('purchases.status') },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="invitaciones"
      :columns="columnas"
      :empty="t('purchases.empty')"
      data-test="tabla-invitaciones"
    >
      <template #fraccion-cell="{ row }">
        <span class="font-mono">{{ t('properties.fractions.label', { number: row.original.fractionNumber }) }}</span>
      </template>

      <template #invitado-cell="{ row }">
        <div class="flex flex-col">
          <span>{{ row.original.email }}</span>
          <span
            v-if="!row.original.inviteeId"
            class="text-xs text-muted"
            :data-test="`sin-cuenta-${row.original.id}`"
          >
            {{ t('purchases.noAccount') }}
          </span>
          <span
            v-if="row.original.referralCode"
            class="text-xs text-muted"
            :data-test="`referido-${row.original.id}`"
          >
            {{ t('purchases.referredBy', { code: row.original.referralCode }) }}
          </span>
        </div>
      </template>

      <template #precio-cell="{ row }">
        <span class="font-mono">{{ precio(row.original) }}</span>
      </template>

      <template #estado-cell="{ row }">
        <UBadge
          :color="COLOR_DE_ESTADO[row.original.status]"
          variant="subtle"
          size="sm"
          :label="t(`purchases.${row.original.status}`)"
          :data-test="`estado-invitacion-${row.original.id}`"
        />
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex flex-wrap justify-end gap-1">
          <UButton
            v-if="puedeCerrar(row.original)"
            variant="ghost"
            size="xs"
            icon="i-lucide-badge-check"
            :disabled="ocupado"
            :title="t('purchases.closeHint')"
            :label="t('purchases.close')"
            :data-test="`cerrar-compra-${row.original.id}`"
            @click="$emit('cerrar', row.original.id)"
          />
          <UButton
            v-if="puedeGestionar && row.original.status === 'pending'"
            variant="ghost"
            color="neutral"
            size="xs"
            :disabled="ocupado"
            :label="t('purchases.cancel')"
            :data-test="`cancelar-invitacion-${row.original.id}`"
            @click="$emit('cancelar', row.original.id)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
