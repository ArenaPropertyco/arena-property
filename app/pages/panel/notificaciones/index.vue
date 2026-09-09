<script setup lang="ts">
/**
 * TR-03 · RF-N.5 — la bandeja, accesible a cualquier rol autenticado (CA-N.5).
 * La página orquesta: carga con el composable, filtra y traduce cada acción en
 * un aviso. Quién ve qué lo decide la RLS.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const toast = useToast()
const { filtradas, filtro, propiedades, noLeidas, pendiente, marcarLeida, marcarTodas } = useNotificaciones()

async function ejecutar(operacion: () => Promise<{ ok: true } | { ok: false, clave: string }>, exito: string) {
  const resultado = await operacion()
  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('notifications.title')"
    :subtitulo="t('notifications.subtitle')"
  >
    <div class="space-y-6">
      <NotificationFilters
        v-model:filtro="filtro"
        :propiedades="propiedades"
        :no-leidas="noLeidas"
      />

      <NotificationsList
        :items="filtradas"
        :pendiente="pendiente"
        @leer="ejecutar(() => marcarLeida($event), 'notifications.messages.read')"
        @leer-todas="ejecutar(marcarTodas, 'notifications.messages.allRead')"
      />
    </div>
  </PanelPage>
</template>
