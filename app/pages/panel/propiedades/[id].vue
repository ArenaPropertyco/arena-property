<script setup lang="ts">
import type { CopAmount } from '#shared/money/importe'
import type { Visibilidad } from '#shared/properties/estados'
import type { FichaTecnica } from '#shared/properties/ficha'
import type { EstadoDeFraccion } from '#shared/properties/fracciones'
import type { TipoDeMedio } from '#shared/properties/medios'
import type { SolicitudDeTraspaso } from '#shared/properties/traspaso'
import type { SolicitudDeInvitacion } from '#shared/purchases/invitaciones'
import { puede } from '#shared/permissions/mapa'

/**
 * HU-08, HU-09, HU-11 — la ficha de una propiedad: datos, estados, medios y las 8
 * fracciones. HU-06 añade las invitaciones de compra y su cierre. La página orquesta
 * y no decide nada: qué acciones caben lo dicen las tablas de transición de
 * `shared/`, y quién puede ejecutarlas, la RLS.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'gestionar_propiedades' } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const localePath = useLocalePath()
const { roles } = useCuenta()

const id = computed(() => String(ruta.params.id ?? ''))

const {
  ficha, fracciones, medios, pendiente, recargar,
  fraccionar, cambiarEstadoDeFraccion, traspasar, subirMedios, quitarMedio,
} = usePropiedad(id)
const { invitaciones, vincular, cancelar, cerrarCompra } = useInvitaciones(id)
const { cuentas } = useCuentas()
const { actualizar, cambiarVisibilidad, ponerALaVenta } = usePropiedades()
// RF-05.1 · las cuentas con rol Administrador entre las que puede elegir.
// El nombre es explícito: `candidatos`, más abajo, son los del traspaso de fracción.
const { administradores: cuentasAdministradoras } = useAdministradores()

const esSuperadmin = computed(() => roles.value.includes('superadmin'))
const puedeGestionar = computed(() => puede(roles.value, 'gestionar_propiedades', { escritura: true }))

const editando = ref(false)
const fraccionando = ref(false)
const traspasando = ref<string | null>(null)
const invitando = ref<string | null>(null)
const ocupado = ref(false)

const fraccionAinvitar = computed(() =>
  fracciones.value.find(fraccion => fraccion.id === invitando.value) ?? null)

const fraccionAtraspasar = computed(() =>
  fracciones.value.find(fraccion => fraccion.id === traspasando.value) ?? null)

/** Candidatos al traspaso: los titulares actuales de la propiedad, sin el de la fracción. */
const candidatos = computed(() => fracciones.value
  .filter(fraccion => fraccion.ownerId && fraccion.ownerId !== fraccionAtraspasar.value?.ownerId)
  .map(fraccion => ({ id: fraccion.ownerId!, label: fraccion.ownerLabel ?? fraccion.ownerId! })))

const fotos = computed(() => medios.value.filter(medio => medio.kind === 'photo').length)

const opcionesDeAdmin = computed(() => cuentasAdministradoras.value
  .map(cuenta => ({ id: cuenta.id, label: cuenta.fullName ?? cuenta.email ?? cuenta.id })))

/** Un único punto de aviso: toda operación termina en un mensaje o en un error. */
async function ejecutar(
  operacion: () => Promise<{ ok: true } | { ok: false, clave: string }>,
  exito: string,
) {
  ocupado.value = true
  const resultado = await operacion()
  ocupado.value = false

  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  return resultado.ok
}

const MENSAJE_DE_VISIBILIDAD: Record<Visibilidad, string> = {
  draft: 'properties.messages.updated',
  published: 'properties.messages.published',
  inactive: 'properties.messages.deactivated',
}

async function guardarFicha(datos: FichaTecnica, asignados: string[]) {
  // Solo el Superadmin gestiona asignaciones; para el resto se pasa `null` y las
  // asignaciones vigentes quedan intactas (RF-05.1).
  const administradores = esSuperadmin.value ? asignados : null

  if (await ejecutar(() => actualizar(id.value, datos, administradores), 'properties.messages.updated')) {
    editando.value = false
  }
}

async function cambiarEstado(destino: Visibilidad) {
  await ejecutar(() => cambiarVisibilidad(id.value, destino), MENSAJE_DE_VISIBILIDAD[destino])
}

async function dividir(precio: CopAmount) {
  if (await ejecutar(() => fraccionar(precio), 'properties.messages.fractioned')) {
    fraccionando.value = false
  }
}

async function moverFraccion(cambio: { id: string, estado: EstadoDeFraccion }) {
  await ejecutar(
    () => cambiarEstadoDeFraccion(cambio.id, cambio.estado),
    'properties.messages.fractionUpdated',
  )
}

async function enviarTraspaso(solicitud: SolicitudDeTraspaso) {
  if (await ejecutar(() => traspasar(solicitud), 'properties.transfer.done')) {
    traspasando.value = null
  }
}

async function cargarMedios(peticion: { tipo: TipoDeMedio, archivos: File[] }) {
  await ejecutar(() => subirMedios(peticion.tipo, peticion.archivos), 'properties.media.uploaded')
}

async function retirarMedio(medio: string) {
  await ejecutar(() => quitarMedio(medio), 'properties.media.removed')
}

// ── HU-06 · vincular propietario: invitación y, si se pide, cierre en el acto ─
async function vincularPropietario(solicitud: SolicitudDeInvitacion, opciones: { cerrarAhora: boolean }) {
  const numero = fraccionAinvitar.value?.number ?? 0
  ocupado.value = true
  const resultado = await vincular(solicitud, opciones)
  ocupado.value = false

  toast.add(resultado.ok
    ? {
        title: resultado.planId
          ? t('purchases.messages.linked', { email: solicitud.email, number: numero })
          : t('purchases.messages.invited', { email: solicitud.email }),
        color: 'success',
      }
    : { title: t(resultado.clave), color: 'error' })

  if (resultado.ok) {
    invitando.value = null
  }
  if (resultado.ok && resultado.planId) {
    await recargar()
  }
}

/** RF-06.2 · RF-06.3 · la base cierra en una transacción; aquí solo se refleja. */
async function registrarVenta(invitacion: string) {
  ocupado.value = true
  const resultado = await cerrarCompra(invitacion)
  ocupado.value = false

  toast.add(resultado.ok
    ? { title: t('purchases.messages.closed'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  if (resultado.ok) {
    await recargar()
  }
}

async function cancelarInvitacion(invitacion: string) {
  await ejecutar(() => cancelar(invitacion), 'purchases.messages.cancelled')
}

function abrirPlan(plan: string) {
  return navigateTo(localePath(`/panel/planes/${plan}`))
}
</script>

<template>
  <PanelPage
    :titulo="ficha?.name ?? t('properties.detailTitle')"
    :subtitulo="ficha ? `${ficha.city}, ${ficha.region}` : undefined"
  >
    <p
      v-if="!pendiente && !ficha"
      class="text-sm text-muted"
      data-test="propiedad-no-encontrada"
    >
      {{ t('properties.notFound') }}
    </p>

    <div
      v-else-if="ficha"
      class="space-y-10"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <PropertyStateBadge
          :visibility="ficha.visibility"
          :commercial="ficha.commercialDerived ?? (ficha.comingSoon ? 'coming_soon' : null)"
        />

        <div class="flex flex-wrap items-center gap-2">
          <PropertyStateActions
            v-if="puedeGestionar"
            :visibility="ficha.visibility"
            :coming-soon="ficha.comingSoon"
            :fraccionada="ficha.fractionCount === 8"
            :ocupado="ocupado"
            @visibilidad="cambiarEstado"
            @salir-de-proximamente="ejecutar(() => ponerALaVenta(id), 'properties.messages.released')"
          />

          <UButton
            v-if="puedeGestionar"
            variant="outline"
            size="sm"
            icon="i-lucide-pencil"
            :label="t('properties.edit')"
            data-test="editar-propiedad"
            @click="editando = true"
          />
        </div>
      </div>

      <PropertySheet :ficha="ficha" />

      <section class="space-y-4">
        <SectionHeading :titulo="t('properties.media.title')" />
        <PropertyMediaGallery
          :medios="medios"
          :puede-gestionar="puedeGestionar"
          :subiendo="ocupado"
          @subir="cargarMedios"
          @quitar="retirarMedio"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('properties.fractions.title')" />

        <div
          v-if="puedeGestionar && fracciones.length === 0"
          class="flex justify-end"
        >
          <UButton
            variant="outline"
            size="sm"
            :label="t('properties.fractions.split')"
            data-test="fraccionar-propiedad"
            @click="fraccionando = true"
          />
        </div>

        <FractionsTable
          :fracciones="fracciones"
          :puede-gestionar="puedeGestionar"
          :es-superadmin="esSuperadmin"
          @transicion="moverFraccion"
          @traspasar="traspasando = $event"
          @invitar="invitando = $event"
          @abrir-plan="abrirPlan"
        />
      </section>

      <section
        v-if="puedeGestionar && fracciones.length > 0"
        class="space-y-4"
      >
        <SectionHeading :titulo="t('purchases.title')" />
        <p class="text-sm text-muted">
          {{ t('purchases.subtitle') }}
        </p>

        <PurchaseInvitationsTable
          :invitaciones="invitaciones"
          :puede-gestionar="puedeGestionar"
          :ocupado="ocupado"
          @cerrar="registrarVenta"
          @cancelar="cancelarInvitacion"
        />
      </section>
    </div>

    <USlideover
      v-model:open="editando"
      :title="t('properties.edit')"
    >
      <template #body>
        <PropertyForm
          v-if="ficha"
          :modelo="{
            name: ficha.name,
            areaM2: ficha.areaM2,
            bedrooms: ficha.bedrooms,
            bathrooms: ficha.bathrooms,
            parkingSpots: ficha.parkingSpots,
            description: ficha.description,
            amenities: ficha.amenities,
            location: {
              country: ficha.country,
              region: ficha.region,
              city: ficha.city,
              address: ficha.address,
            },
            videoUrl: ficha.videoUrl,
          }"
          :fotos="Math.max(fotos, 1)"
          :guardando="ocupado"
          modo="editar"
          :administradores="opcionesDeAdmin"
          :asignados="ficha.adminIds"
          :puede-asignar="esSuperadmin"
          @submit="guardarFicha"
        />
      </template>
    </USlideover>

    <UModal
      v-model:open="fraccionando"
      :title="t('properties.fractions.split')"
    >
      <template #body>
        <FractionSplitForm
          :enviando="ocupado"
          @submit="dividir"
        />
      </template>
    </UModal>

    <UModal
      :open="fraccionAinvitar !== null"
      :title="fraccionAinvitar ? t('purchases.inviteTitle', { number: fraccionAinvitar.number }) : ''"
      @update:open="invitando = null"
    >
      <template #body>
        <PurchaseInviteForm
          v-if="fraccionAinvitar"
          :fraccion="fraccionAinvitar"
          :cuentas="cuentas"
          :enviando="ocupado"
          @submit="vincularPropietario"
        />
      </template>
    </UModal>

    <UModal
      :open="fraccionAtraspasar !== null"
      :title="t('properties.transfer.title')"
      @update:open="traspasando = null"
    >
      <template #body>
        <FractionTransferForm
          v-if="fraccionAtraspasar"
          :fraccion="fraccionAtraspasar"
          :candidatos="candidatos"
          :enviando="ocupado"
          @submit="enviarTraspaso"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
