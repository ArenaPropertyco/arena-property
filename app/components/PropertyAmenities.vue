<script setup lang="ts">
/** HU-02 · RF-02.2 — el equipamiento de la propiedad, como lista de distintivos. */
defineProps<{ amenities: string[] }>()
</script>

<template>
  <ul
    v-if="amenities.length > 0"
    class="flex flex-wrap gap-2"
    data-test="equipamiento"
  >
    <li
      v-for="amenity in amenities"
      :key="amenity"
    >
      <UBadge
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-lucide-check"
        :label="amenity"
      />
    </li>
  </ul>
</template>
