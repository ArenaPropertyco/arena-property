<script setup lang="ts">
import type { SignupValidationKey } from '#shared/referrals/signup'
import type { AmbassadorStatus } from '#shared/referrals/views'

/**
 * HU-49 · RF-49.4, CA-49.3, CA-49.4 — en qué punto del programa está la cuenta:
 * pendiente de aprobación, aprobada, rechazada con su motivo, suspendida, o sin
 * derecho a inscribirse por su rol.
 *
 * Recibe el estado ya resuelto y solo lo cuenta; el aviso de rol denegado llega
 * como clave del motor puro (`canSignUp`).
 */
const props = defineProps<{
  status: AmbassadorStatus | null
  reason: string | null
  deniedKey: SignupValidationKey | null
}>()

const { t } = useI18n()

type Aviso = {
  color: 'success' | 'warning' | 'error' | 'neutral'
  icon: string
  descripcion: string
  marca: string
}

const aviso = computed<Aviso | null>(() => {
  switch (props.status) {
    case 'approved':
      return { color: 'success', icon: 'i-lucide-badge-check', descripcion: t('referrals.signup.approvedNotice'), marca: 'inscripcion-aprobada' }
    case 'pending':
      return { color: 'warning', icon: 'i-lucide-hourglass', descripcion: t('referrals.signup.pending'), marca: 'inscripcion-pendiente' }
    case 'rejected':
      return { color: 'error', icon: 'i-lucide-x-circle', descripcion: t('referrals.signup.rejectedNotice', { reason: props.reason ?? '' }), marca: 'inscripcion-rechazada' }
    case 'suspended':
      return { color: 'neutral', icon: 'i-lucide-pause-circle', descripcion: t('referrals.signup.suspendedNotice'), marca: 'inscripcion-suspendida' }
    default:
      return props.deniedKey
        ? { color: 'neutral', icon: 'i-lucide-info', descripcion: t(props.deniedKey), marca: 'inscripcion-denegada' }
        : null
  }
})
</script>

<template>
  <UAlert
    v-if="aviso"
    :color="aviso.color"
    variant="subtle"
    :icon="aviso.icon"
    :title="t('referrals.signup.statusTitle')"
    :description="aviso.descripcion"
    :data-test="aviso.marca"
  />
</template>
