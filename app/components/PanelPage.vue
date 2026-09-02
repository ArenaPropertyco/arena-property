<script setup lang="ts">
/**
 * Marco de toda página del panel: barra superior con el título, el control de la
 * barra lateral y el menú de cuenta, y cuerpo desplazable. Las páginas ponen dentro
 * sus componentes.
 *
 * La cuenta llega del layout por el puente de `useCuentaDelPanel`: este componente no
 * la consulta, y montado fuera del panel simplemente no muestra el menú.
 */
defineProps<{
  titulo: string
  subtitulo?: string
}>()

const panel = useCuentaDelPanel()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="titulo">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template
          v-if="panel?.cuenta.value"
          #right
        >
          <UserMenu
            :nombre="panel.cuenta.value.nombre"
            :email="panel.cuenta.value.email"
            :roles="panel.cuenta.value.roles"
            compacto
            @salir="panel.salir"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p
        v-if="subtitulo"
        class="mb-6 text-sm text-muted"
      >
        {{ subtitulo }}
      </p>
      <slot />
    </template>
  </UDashboardPanel>
</template>
