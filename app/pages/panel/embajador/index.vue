<script setup lang="ts">
import type { SignupDraft } from '#shared/referrals/signup'

/**
 * HU-49 · RF-49.1…RF-49.4 y HU-50 · RF-50.2…RF-50.4 — el Programa de Referidos
 * visto por quien participa en él.
 *
 * La página orquesta según en qué punto está la cuenta: sin inscripción monta el
 * formulario si el rol lo permite (CA-49.4); inscrita y pendiente, el aviso;
 * aprobada, el código con su enlace y sus botones de difusión.
 *
 * La ruta es privada a secas y no exige capacidad: la de inscribirse deja de
 * aplicar justo cuando la persona ya es Embajador, que es cuando más necesita
 * entrar aquí.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const toast = useToast()
const { inscripcion, elegibilidad, versionDeTerminos, pendiente, inscribir } = useInscripcionEmbajador()

const config = useRuntimeConfig()
const url = useRequestURL()
const baseUrl = computed(() => (config.public.site as { url?: string } | undefined)?.url || url.origin)

const enviando = ref(false)

async function enviarInscripcion(borrador: SignupDraft) {
  enviando.value = true
  const resultado = await inscribir(borrador)
  enviando.value = false
  toast.add(resultado.ok
    ? { title: t('referrals.signup.sent'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('referrals.signup.title')"
    :subtitulo="t('referrals.signup.hint')"
  >
    <div
      v-if="!pendiente"
      class="space-y-8"
    >
      <!-- El estado de la inscripción, con su motivo cuando lo hay (CA-49.3, CA-49.4). -->
      <AmbassadorStatusNotice
        :status="inscripcion?.status ?? null"
        :reason="inscripcion?.rejectionReason ?? null"
        :denied-key="!inscripcion && !elegibilidad.allowed ? elegibilidad.reason : null"
      />

      <!-- RF-50.2 · RF-50.3 · aprobada: el código, su enlace y la difusión. -->
      <ReferralCodeCard
        v-if="inscripcion?.status === 'approved' && inscripcion.code"
        :code="inscripcion.code"
        :base-url="baseUrl"
      />

      <!-- CA-49.4 · sin inscripción: el formulario solo si el rol participa. -->
      <AmbassadorSignupForm
        v-else-if="!inscripcion && elegibilidad.allowed"
        :terms-version="versionDeTerminos"
        :enviando="enviando"
        @submit="enviarInscripcion"
      />
    </div>
  </PanelPage>
</template>
