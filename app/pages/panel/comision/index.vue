<script setup lang="ts">
import type { CommissionTypeDraft } from '#shared/referrals/commission'

/**
 * HU-52 · RF-52.1…RF-52.4 · D-37 — el Superadmin administra los tipos de comisión
 * del Programa de Referidos y decide cuál lleva cada Embajador.
 *
 * La página orquesta: pide el catálogo y los Embajadores aprobados, monta el
 * formulario de alta, la lista de tipos y la tabla de asignación. Ninguna regla
 * vive aquí: validar, resolver el tipo aplicable y calcular la comisión son de
 * `shared/referrals/commission`, y la base las repite.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'definir_comision' } })

const { t } = useI18n()
const toast = useToast()
const { tipos, disponibles, asignaciones, crear, marcarPredeterminado, activar, asignar } = useComision()

const formulario = useTemplateRef('formulario')
const creando = ref(false)
const tipoOcupado = ref<string | null>(null)
const embajadorOcupado = ref<string | null>(null)

function avisar(resultado: { ok: true } | { ok: false, clave: string }, exito: string) {
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}

async function crearTipo(borrador: CommissionTypeDraft) {
  creando.value = true
  const resultado = await crear(borrador)
  creando.value = false
  avisar(resultado, 'referrals.commission.created')
  if (resultado.ok) {
    formulario.value?.limpiar()
  }
}

async function nombrarPredeterminado(id: string) {
  tipoOcupado.value = id
  const resultado = await marcarPredeterminado(id)
  tipoOcupado.value = null
  avisar(resultado, 'referrals.commission.defaultChanged')
}

async function cambiarActivo(id: string, activo: boolean) {
  tipoOcupado.value = id
  const resultado = await activar(id, activo)
  tipoOcupado.value = null
  avisar(resultado, activo ? 'referrals.commission.activated' : 'referrals.commission.deactivated')
}

async function asignarTipo(ambassadorId: string, commissionTypeId: string | null) {
  embajadorOcupado.value = ambassadorId
  const resultado = await asignar(ambassadorId, commissionTypeId)
  embajadorOcupado.value = null
  avisar(resultado, 'referrals.commission.assigned')
}
</script>

<template>
  <PanelPage
    :titulo="t('referrals.commission.title')"
    :subtitulo="t('referrals.commission.subtitle')"
  >
    <div class="space-y-8">
      <section class="space-y-4">
        <SectionHeading :titulo="t('referrals.commission.create')" />
        <CommissionTypeForm
          ref="formulario"
          :types="tipos"
          :enviando="creando"
          @submit="crearTipo"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('referrals.commission.catalogTitle')" />
        <p class="text-sm text-muted">
          {{ t('referrals.commission.catalogHint') }}
        </p>
        <CommissionTypesList
          :types="tipos"
          :ocupado-id="tipoOcupado"
          @predeterminado="nombrarPredeterminado"
          @activar="cambiarActivo"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('referrals.commission.assignTitle')" />
        <p class="text-sm text-muted">
          {{ t('referrals.commission.assignHint') }}
        </p>
        <AmbassadorCommissionTable
          :ambassadors="asignaciones"
          :types="disponibles"
          :ocupado-id="embajadorOcupado"
          @asignar="asignarTipo"
        />
      </section>
    </div>
  </PanelPage>
</template>
