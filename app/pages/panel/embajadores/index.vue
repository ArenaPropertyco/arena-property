<script setup lang="ts">
/**
 * HU-49 · RF-49.4, RF-49.5 — el Superadmin gestiona las inscripciones al Programa
 * de Referidos: las ve con su estado y sus datos de pago, y las aprueba o rechaza.
 *
 * Aprobar suma el rol Embajador y genera el código; ambas cosas las hace la base
 * en `approve_ambassador`, que también exige motivo para rechazar.
 *
 * La capacidad es `administrar_usuarios_y_roles` porque aprobar una inscripción es
 * exactamente eso: conceder un rol a una cuenta (HU-07).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'administrar_usuarios_y_roles' } })

const { t } = useI18n()
const toast = useToast()
const { embajadores, resolver } = useEmbajadores()

const ocupadoId = ref<string | null>(null)

async function resolverInscripcion(id: string, aprobar: boolean, motivo: string | null) {
  ocupadoId.value = id
  const resultado = await resolver(id, aprobar, motivo)
  ocupadoId.value = null
  toast.add(resultado.ok
    ? { title: t('referrals.ambassadors.resolved'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('referrals.ambassadors.title')"
    :subtitulo="t('referrals.ambassadors.subtitle')"
  >
    <AmbassadorsTable
      :embajadores="embajadores"
      :ocupado-id="ocupadoId"
      @resolver="resolverInscripcion"
    />
  </PanelPage>
</template>
