<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { CONTACTO_ARENA } from '#shared/content/contacto'

/**
 * Pie del sitio institucional (HU-00 · RF-00.6): marca, navegación, contacto y los
 * selectores de idioma y de tema, como la cabecera. Los datos de contacto salen
 * de `shared/content/contacto`, los mismos del sitio oficial.
 */
defineProps<{
  inicio: string
  items: NavigationMenuItem[]
}>()

const { t } = useI18n()
const anio = new Date().getFullYear()
</script>

<template>
  <UFooter :ui="{ top: 'border-t border-default', root: 'bg-elevated/30' }">
    <template #top>
      <UContainer class="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-4 sm:col-span-2 lg:col-span-2">
          <AppBrand :to="inicio" />
          <p class="max-w-sm text-sm text-muted">
            {{ t('footer.tagline') }}
          </p>
        </div>

        <nav :aria-label="t('footer.explore')">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {{ t('footer.explore') }}
          </p>
          <ul class="mt-4 space-y-2">
            <li
              v-for="item in items"
              :key="String(item.to)"
            >
              <ULink
                :to="item.to"
                class="text-sm text-default hover:text-primary"
              >
                {{ item.label }}
              </ULink>
            </li>
          </ul>
        </nav>

        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {{ t('footer.contact') }}
          </p>
          <ul class="mt-4 space-y-2 text-sm">
            <li>
              <ULink
                :to="CONTACTO_ARENA.whatsappUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-2 hover:text-primary"
              >
                <UIcon
                  name="i-lucide-message-circle"
                  class="size-4"
                />
                {{ t('footer.whatsapp') }} · <span class="font-mono">{{ CONTACTO_ARENA.whatsapp }}</span>
              </ULink>
            </li>
            <li class="inline-flex items-center gap-2 text-muted">
              <UIcon
                name="i-lucide-map-pin"
                class="size-4"
              />
              {{ t('footer.city') }}
            </li>
          </ul>
          <div class="mt-4 flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </UContainer>
    </template>

    <p class="text-center text-sm text-muted">
      © {{ anio }} {{ t('app.name') }}. {{ t('footer.rights') }}
    </p>
  </UFooter>
</template>
