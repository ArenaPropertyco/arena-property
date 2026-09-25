<script setup lang="ts">
/**
 * Tarjeta plegable del panel (RT-06): un encabezado siempre visible —icono,
 * título, una línea de contexto y lo que la sección quiera anunciar (estado,
 * contadores)— y una flecha que despliega el contenido con `UCollapsible`.
 *
 * En móvil evita que las secciones largas se apilen sin fin; en escritorio ordena
 * la página. El contenido no se desmonta al plegar: los formularios conservan lo
 * escrito. Presenta y nada más: qué va dentro lo decide la página.
 */
const props = withDefaults(defineProps<{
  /** Nombre corto para los `data-test`: `seccion-…`, `plegar-…`, `contenido-…`. */
  nombre: string
  titulo: string
  descripcion?: string | null
  icono?: string
  /** Un aviso corto que se ve sin abrir: «3 pendientes». */
  aviso?: string | null
  /** Desplegada al montar; después manda quien la pliega o despliega. */
  abiertaAlInicio?: boolean
}>(), {
  descripcion: null,
  icono: 'i-lucide-layout-list',
  aviso: null,
  abiertaAlInicio: false,
})

const abierta = ref(props.abiertaAlInicio)

const { t } = useI18n()
</script>

<template>
  <UCollapsible
    v-model:open="abierta"
    :unmount-on-hide="false"
    class="rounded-2xl border border-default bg-default"
    :data-test="`seccion-${nombre}`"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="group h-auto justify-start gap-3 rounded-2xl p-4 text-start sm:gap-4 sm:p-5"
      :aria-label="t('calendar.sections.toggle', { section: titulo })"
      :data-test="`plegar-${nombre}`"
    >
      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UIcon
          :name="icono"
          class="size-5"
        />
      </span>

      <span class="min-w-0 flex-1 space-y-1">
        <span class="block font-display text-lg leading-tight text-highlighted sm:text-xl">{{ titulo }}</span>
        <span
          v-if="descripcion"
          class="line-clamp-2 block text-xs font-normal text-muted group-data-[state=open]:line-clamp-none sm:text-sm"
        >{{ descripcion }}</span>
      </span>

      <!-- Lo que la sección anuncia sin abrirse: un estado, un contador. -->
      <span
        v-if="$slots.extra || aviso"
        class="hidden shrink-0 items-center gap-2 sm:flex"
      >
        <UBadge
          v-if="aviso"
          color="warning"
          variant="subtle"
          :label="aviso"
          :data-test="`aviso-${nombre}`"
        />
        <slot name="extra" />
      </span>

      <UIcon
        name="i-lucide-chevron-down"
        class="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </UButton>

    <template #content>
      <div
        class="space-y-4 border-t border-default p-4 sm:p-5"
        :data-test="`contenido-${nombre}`"
      >
        <!-- En móvil el extra no cabe en el encabezado: se muestra al abrir. -->
        <div
          v-if="$slots.extra || aviso"
          class="flex flex-wrap items-center gap-2 sm:hidden"
        >
          <UBadge
            v-if="aviso"
            color="warning"
            variant="subtle"
            :label="aviso"
          />
          <slot name="extra" />
        </div>
        <slot />
      </div>
    </template>
  </UCollapsible>
</template>
