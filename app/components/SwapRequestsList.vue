<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SwapRequestListed, SwapRequestStatus } from '#shared/scheduling/vistas'

/**
 * HU-12 · RF-12.6 · D-32 — las solicitudes de intercambio: el Propietario ve las
 * suyas y su estado; el Administrador aprueba o rechaza con motivo (CA-12.11).
 */
defineProps<{
  requests: SwapRequestListed[]
  canResolve: boolean
  ocupadaId: string | null
}>()

const emit = defineEmits<{ resolver: [string, boolean, string | null] }>()

const { t, locale } = useI18n()

const motivos = reactive<Record<string, string>>({})
const errores = ref<Map<string, string>>(new Map())

const COLOR: Record<SwapRequestStatus, 'warning' | 'success' | 'error'> = {
  open: 'warning',
  approved: 'success',
  rejected: 'error',
}

function rechazar(id: string) {
  const motivo = (motivos[id] ?? '').trim()
  if (motivo === '') {
    errores.value.set(id, t('calendar.swaps.validation.reason_required'))
    return
  }
  errores.value.delete(id)
  emit('resolver', id, false, motivo)
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="lista-solicitudes"
  >
    <p
      v-if="requests.length === 0"
      class="text-sm text-muted"
      data-test="sin-solicitudes"
    >
      {{ t('calendar.swaps.noRequests') }}
    </p>

    <article
      v-for="request in requests"
      :key="request.id"
      class="space-y-3 rounded-2xl border border-default bg-default p-4"
      :data-test="`solicitud-${request.id}`"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1 text-sm">
          <p class="text-highlighted">
            {{ t('calendar.swaps.requestLine', {
              from: t('calendar.fractionLabel', { n: request.requesterFraction }),
              offered: request.offeredWeek + 1,
              requested: request.requestedWeek + 1,
              to: t('calendar.fractionLabel', { n: request.targetFraction }),
            }) }}
          </p>
          <p class="text-xs text-muted">
            {{ t(`calendar.seasons.${request.season}`) }} · {{ formatearInstante(request.createdAt, locale as Idioma) }}
          </p>
          <p
            v-if="request.message"
            class="text-muted"
            data-test="mensaje"
          >
            «{{ request.message }}»
          </p>
          <p
            v-if="request.resolutionReason"
            class="text-muted"
            data-test="motivo-resolucion"
          >
            {{ request.resolutionReason }}
          </p>
        </div>
        <UBadge
          :color="COLOR[request.status]"
          variant="subtle"
          :label="t(`calendar.swaps.status.${request.status}`)"
          :data-test="`estado-${request.id}`"
        />
      </div>

      <UForm
        v-if="canResolve && request.status === 'open'"
        :state="motivos"
        class="flex flex-wrap items-end gap-2 border-t border-default pt-3"
        @submit.prevent="rechazar(request.id)"
      >
        <UFormField
          :label="t('calendar.swaps.rejectReason')"
          :error="errores.get(request.id)"
          class="min-w-56 flex-1"
        >
          <UInput
            v-model="motivos[request.id]"
            class="w-full"
            :data-test="`motivo-rechazo-${request.id}`"
          />
        </UFormField>
        <UButton
          type="submit"
          variant="outline"
          color="error"
          icon="i-lucide-x"
          :loading="ocupadaId === request.id"
          :label="t('calendar.swaps.reject')"
          :data-test="`rechazar-${request.id}`"
        />
        <UButton
          type="button"
          color="success"
          icon="i-lucide-check"
          :loading="ocupadaId === request.id"
          :label="t('calendar.swaps.approve')"
          :data-test="`aprobar-${request.id}`"
          @click="emit('resolver', request.id, true, null)"
        />
      </UForm>
    </article>
  </div>
</template>
