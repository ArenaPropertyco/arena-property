<script setup lang="ts">
import type { EstadoCuenta } from '#shared/permissions/acceso'

/**
 * Estado de una cuenta (HU-05 · RF-05.4, HU-33) con la semántica de color de marca:
 * verde solo para activa, rojo para suspendida.
 */
defineProps<{ status: EstadoCuenta }>()

const { t } = useI18n()
</script>

<template>
  <UBadge
    :color="status === 'active' ? 'success' : 'error'"
    variant="subtle"
    size="sm"
    :label="status === 'active' ? t('admins.active') : t('admins.suspended')"
  />
</template>
