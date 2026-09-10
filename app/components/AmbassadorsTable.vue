<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { AmbassadorListed, AmbassadorStatus } from '#shared/referrals/views'

/**
 * HU-49 · RF-49.4, RF-49.5 — la lista de inscritos al programa que gestiona el
 * Superadmin: estado, datos de pago, código y fecha de alta. Aprobar suma el rol
 * Embajador (CA-49.2); rechazar exige motivo.
 */
defineProps<{
  embajadores: AmbassadorListed[]
  ocupadoId: string | null
}>()

const emit = defineEmits<{ resolver: [string, boolean, string | null] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR: Record<AmbassadorStatus, 'warning' | 'success' | 'error' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  suspended: 'neutral',
}

const motivos = reactive<Record<string, string>>({})
const errores = ref<Map<string, string>>(new Map())

function rechazar(id: string) {
  const motivo = (motivos[id] ?? '').trim()
  if (motivo === '') {
    errores.value.set(id, t('referrals.ambassadors.reasonRequired'))
    return
  }
  errores.value.delete(id)
  emit('resolver', id, false, motivo)
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="tabla-embajadores"
  >
    <p
      v-if="embajadores.length === 0"
      class="text-sm text-muted"
      data-test="sin-embajadores"
    >
      {{ t('referrals.ambassadors.empty') }}
    </p>

    <article
      v-for="embajador in embajadores"
      :key="embajador.id"
      class="space-y-3 rounded-2xl border border-default bg-default p-4"
      :data-test="`embajador-${embajador.id}`"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1 text-sm">
          <p class="text-highlighted">
            {{ embajador.fullName ?? embajador.email }}
          </p>
          <p class="text-muted">
            {{ embajador.email }}
          </p>
          <p class="text-xs text-muted">
            {{ t('referrals.ambassadors.bankLine', {
              bank: embajador.bank,
              kind: t(`referrals.signup.accountKinds.${embajador.accountKind}`),
              account: embajador.accountNumber,
              holder: embajador.holder,
            }) }}
          </p>
          <p class="text-xs text-muted">
            {{ t('referrals.ambassadors.enrolledAt', { date: formatearInstante(embajador.enrolledAt, idioma) }) }}
          </p>
          <p
            v-if="embajador.code"
            class="font-mono text-xs text-highlighted"
            :data-test="`codigo-${embajador.id}`"
          >
            {{ embajador.code }}
          </p>
        </div>
        <UBadge
          :color="COLOR[embajador.status]"
          variant="subtle"
          :label="t(`referrals.ambassadors.status.${embajador.status}`)"
          :data-test="`estado-${embajador.id}`"
        />
      </div>

      <UForm
        v-if="embajador.status === 'pending'"
        :state="motivos"
        class="flex flex-wrap items-end gap-2 border-t border-default pt-3"
        :data-test="`formulario-rechazo-${embajador.id}`"
        @submit.prevent="rechazar(embajador.id)"
      >
        <UFormField
          :label="t('referrals.ambassadors.rejectReason')"
          :error="errores.get(embajador.id)"
          class="min-w-56 flex-1"
        >
          <UInput
            v-model="motivos[embajador.id]"
            class="w-full"
            :data-test="`motivo-rechazo-${embajador.id}`"
          />
        </UFormField>
        <UButton
          type="submit"
          variant="outline"
          color="error"
          icon="i-lucide-x"
          :loading="ocupadoId === embajador.id"
          :label="t('referrals.ambassadors.reject')"
          :data-test="`rechazar-${embajador.id}`"
        />
        <UButton
          type="button"
          color="success"
          icon="i-lucide-check"
          :loading="ocupadoId === embajador.id"
          :label="t('referrals.ambassadors.approve')"
          :data-test="`aprobar-${embajador.id}`"
          @click="emit('resolver', embajador.id, true, null)"
        />
      </UForm>
    </article>
  </div>
</template>
