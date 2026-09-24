<script setup lang="ts">
import type { CuentaConRoles } from '#shared/identity/cuentas'
import { efectoDeSuspension, TIPOS_DE_SUSPENSION, validarSuspension } from '#shared/identity/suspension'
import type { TipoDeSuspension } from '#shared/identity/suspension'

/**
 * HU-33 · RF-33.1, RF-33.3 · D-07 — suspender una cuenta con motivo y tipo.
 *
 * Valida con el dominio antes de emitir (CA-33.1) y cuenta, junto a cada tipo,
 * qué pasa con el saldo del Embajador: administrativa lo conserva; por
 * incumplimiento o fraude pierde lo pendiente y lo en gracia, y lo disponible
 * queda a decisión del Superadmin con constancia. La base vuelve a exigir lo
 * mismo y aplica el efecto.
 */
defineProps<{
  cuenta: CuentaConRoles
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [kind: TipoDeSuspension, reason: string] }>()

const { t } = useI18n()

const estado = reactive({ kind: null as TipoDeSuspension | null, reason: '' })
const errores = ref<{ kind?: string, reason?: string }>({})

const opciones = computed(() => TIPOS_DE_SUSPENSION.map(kind => ({
  value: kind,
  label: t(`account.suspension.kinds.${kind}`),
  description: t(`account.suspension.effects.${kind}`),
})))

const efecto = computed(() => (estado.kind ? efectoDeSuspension(estado.kind) : null))

function enviar() {
  const encontrados = validarSuspension({ kind: estado.kind, reason: estado.reason })
  errores.value = {
    kind: encontrados.find(clave => clave.endsWith('kind_required')) ? t('account.suspension.validation.kind_required') : undefined,
    reason: encontrados.find(clave => clave.endsWith('reason_required')) ? t('account.suspension.validation.reason_required') : undefined,
  }
  if (encontrados.length > 0 || estado.kind === null) {
    return
  }
  emit('submit', estado.kind, estado.reason.trim())
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-suspension"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('account.suspension.subtitle', { account: cuenta.fullName ?? cuenta.email ?? cuenta.id }) }}
    </p>

    <UFormField
      :label="t('account.suspension.kind')"
      :error="errores.kind"
      required
      data-test="campo-suspension-tipo"
    >
      <URadioGroup
        v-model="estado.kind"
        :items="opciones"
        value-key="value"
        data-test="suspension-tipo"
      />
    </UFormField>

    <!-- RF-33.3 · D-07 · lo que decide el tipo, dicho antes de confirmar. -->
    <UAlert
      v-if="efecto && efecto.resuelveDisponible"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('account.suspension.fraudWarning')"
      data-test="aviso-fraude"
    />

    <UFormField
      :label="t('account.suspension.reason')"
      :error="errores.reason"
      required
      data-test="campo-suspension-motivo"
    >
      <UTextarea
        v-model="estado.reason"
        :rows="3"
        :placeholder="t('account.suspension.reasonPlaceholder')"
        class="w-full"
        data-test="suspension-motivo"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="error"
        icon="i-lucide-user-round-x"
        :loading="enviando"
        :label="t('account.suspension.submit')"
        data-test="confirmar-suspension"
      />
    </div>
  </UForm>
</template>
