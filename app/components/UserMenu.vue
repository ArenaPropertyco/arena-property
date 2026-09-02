<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { inicialesDe } from '#shared/identity/perfil'
import type { Rol } from '#shared/permissions/roles'

/**
 * Menú de la cuenta: quién eres y cómo salir. Presenta y emite; no sabe de Supabase
 * ni de rutas. Se usa en dos sitios del panel —la barra superior y el pie de la barra
 * lateral—, así que `compacto` decide si se muestra solo el avatar o también el nombre.
 */
withDefaults(defineProps<{
  nombre: string
  email?: string | null
  roles?: readonly Rol[]
  /** Barra superior: solo el avatar. Pie de la barra lateral: avatar, nombre y correo. */
  compacto?: boolean
}>(), {
  email: null,
  roles: () => [],
  compacto: false,
})

const emit = defineEmits<{ salir: [] }>()

const { t } = useI18n()

const opciones = computed<DropdownMenuItem[][]>(() => [
  [{
    label: t('actions.logout'),
    icon: 'i-lucide-log-out',
    onSelect: () => emit('salir'),
  }],
])
</script>

<template>
  <!--
    El `data-test` va en el disparador, no en `UDropdownMenu`: su raíz es de Reka UI
    y no pinta un elemento propio, así que el atributo nunca llegaría al DOM.
  -->
  <UDropdownMenu
    :items="opciones"
    :ui="{ content: 'w-56' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :block="!compacto"
      :square="compacto"
      :aria-label="t('account.menu')"
      :class="compacto ? '' : 'justify-start'"
      data-test="menu-cuenta"
    >
      <UAvatar
        :text="inicialesDe(nombre)"
        size="sm"
      />

      <span
        v-if="!compacto"
        class="min-w-0 flex-1 text-start"
      >
        <span class="block truncate text-sm text-default">{{ nombre }}</span>
        <span
          v-if="email"
          class="block truncate text-xs text-muted"
        >{{ email }}</span>
      </span>

      <UIcon
        v-if="!compacto"
        name="i-lucide-chevron-up"
        class="size-4 shrink-0 text-muted"
      />
    </UButton>

    <template #content-top>
      <div class="border-b border-default px-2 py-2">
        <p class="truncate text-sm font-medium text-default">
          {{ nombre }}
        </p>
        <p
          v-if="email"
          class="truncate text-xs text-muted"
          data-test="correo-cuenta"
        >
          {{ email }}
        </p>

        <div
          v-if="roles.length"
          class="mt-2 flex flex-wrap gap-1"
        >
          <UBadge
            v-for="rol in roles"
            :key="rol"
            color="neutral"
            variant="subtle"
            size="sm"
            :label="t(`roles.names.${rol}`)"
            :data-test="`rol-${rol}`"
          />
        </div>
      </div>
    </template>
  </UDropdownMenu>
</template>
