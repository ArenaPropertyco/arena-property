<script setup lang="ts">
import type { NuevoComunicado } from '#shared/notifications/comunicados'

/**
 * HU-31 · RF-31.1, RF-31.3, RF-31.4 — los comunicados globales del Superadmin.
 *
 * La página orquesta: lista el registro que trae `useComunicados`, abre el
 * formulario y traduce el resultado en un aviso. Es una pantalla del Superadmin:
 * la barra lateral solo se la ofrece a él y la RLS de `broadcasts` rechaza a
 * cualquier otro (RF-31.4); a quien llegue por la URL se le dice, no se le
 * finge un formulario que la base no aceptaría.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const toast = useToast()
const { roles } = useCuenta()
const { comunicados, propiedadesSegmentables, pendiente, enviar } = useComunicados()

const esSuperadmin = computed(() => roles.value.includes('superadmin'))

const redactando = ref(false)
const ocupado = ref(false)

async function guardar(nuevo: NuevoComunicado) {
  ocupado.value = true
  const resultado = await enviar(nuevo)
  ocupado.value = false
  toast.add(resultado.ok
    ? { title: t('broadcasts.messages.sent'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
  if (resultado.ok) {
    redactando.value = false
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('broadcasts.title')"
    :subtitulo="t('broadcasts.subtitle')"
  >
    <p
      v-if="!esSuperadmin"
      class="text-sm text-muted"
      data-test="solo-superadmin"
    >
      {{ t('broadcasts.onlySuperadmin') }}
    </p>

    <div
      v-else
      class="space-y-6"
    >
      <div class="flex justify-end">
        <UButton
          icon="i-lucide-send"
          :label="t('broadcasts.send')"
          data-test="redactar-comunicado"
          @click="redactando = true"
        />
      </div>

      <BroadcastsTable
        :comunicados="comunicados"
        :pendiente="pendiente"
      />
    </div>

    <USlideover
      v-model:open="redactando"
      :title="t('broadcasts.sendTitle')"
      :description="t('broadcasts.sendHint')"
    >
      <template #body>
        <BroadcastForm
          v-if="redactando"
          :propiedades="propiedadesSegmentables"
          :enviando="ocupado"
          @submit="guardar"
        />
      </template>
    </USlideover>
  </PanelPage>
</template>
