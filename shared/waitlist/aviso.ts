/**
 * HU-47 · RF-47.4 · CA-47.4 — a quién se avisa cuando una fracción de la
 * propiedad vuelve a estar disponible: a los inscritos, en orden de inscripción y
 * una sola vez por persona. La base aplica la misma regla en su disparador y en
 * su unicidad por correo y propiedad; aquí vive para razonar y probarla.
 */

export interface InscritoEnEspera {
  id: string
  email: string
  createdAt: string
  notifiedAt: string | null
}

export function destinatariosDeLiberacion(inscritos: readonly InscritoEnEspera[]): InscritoEnEspera[] {
  const vistos = new Set<string>()

  return [...inscritos]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter((inscrito) => {
      if (inscrito.notifiedAt !== null) {
        return false
      }
      const correo = inscrito.email.trim().toLowerCase()
      if (vistos.has(correo)) {
        return false
      }
      vistos.add(correo)
      return true
    })
}
