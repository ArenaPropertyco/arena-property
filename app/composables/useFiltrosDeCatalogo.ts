import type { FiltroDeCatalogo, PropiedadPublica } from '#shared/properties/catalogo-publico'
import {
  filtrarCatalogo,
  filtroDeCatalogoVacio,
  rangoDePrecios,
  regionesDelCatalogo,
} from '#shared/properties/catalogo-publico'

/**
 * HU-01 · RF-01.3 · D-18 — filtros combinables del catálogo público.
 *
 * El composable guarda el criterio y llama a la función pura de `shared`: la
 * misma regla se prueba sin Nuxt (CA-01.2, CA-01.3). Las opciones salen de los
 * datos, nunca de una lista escrita a mano.
 */
export function useFiltrosDeCatalogo(propiedades: Ref<PropiedadPublica[]>) {
  const filtro = ref<FiltroDeCatalogo>(filtroDeCatalogoVacio())

  const filtradas = computed(() => filtrarCatalogo(propiedades.value, filtro.value))
  const regiones = computed(() => regionesDelCatalogo(propiedades.value))
  const rango = computed(() => rangoDePrecios(propiedades.value))

  function limpiar() {
    filtro.value = filtroDeCatalogoVacio()
  }

  return { filtro, filtradas, regiones, rango, limpiar }
}
