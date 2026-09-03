import type { FiltroDePropiedades } from '#shared/properties/catalogo'
import { administradoresDe, filtrarPropiedades, filtroVacio, regionesDe } from '#shared/properties/catalogo'
import type { OpcionDeCuenta, PropiedadDelPanel } from '#shared/properties/vistas'

/**
 * HU-10 · RF-10.2 — filtros combinables de propiedades, reutilizables.
 *
 * El composable solo guarda el criterio y llama al filtro puro de `shared`: la
 * misma función que usa el catálogo público (HU-01). Las opciones que ofrece salen
 * de los datos que recibe, nunca de una lista escrita a mano que se desactualice.
 */
export function useFiltrosDePropiedades(propiedades: Ref<PropiedadDelPanel[]>) {
  const filtro = ref<FiltroDePropiedades>(filtroVacio())

  const filtradas = computed(() => filtrarPropiedades(propiedades.value, filtro.value))

  const regiones = computed(() => regionesDe(propiedades.value))

  /** Administradores presentes, con la etiqueta que ya trae cada propiedad. */
  const administradores = computed<OpcionDeCuenta[]>(() => {
    const etiquetas = new Map<string, string>()
    for (const propiedad of propiedades.value) {
      for (const id of propiedad.adminIds) {
        if (propiedad.adminLabel && !etiquetas.has(id)) {
          etiquetas.set(id, propiedad.adminLabel)
        }
      }
    }

    return administradoresDe(propiedades.value)
      .map(id => ({ id, label: etiquetas.get(id) ?? id }))
  })

  function limpiar() {
    filtro.value = filtroVacio()
  }

  return { filtro, filtradas, regiones, administradores, limpiar }
}
