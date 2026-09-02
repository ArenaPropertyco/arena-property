/**
 * Formas de cuenta que comparten composables y componentes (HU-05, HU-07).
 * Solo tipos: describen lo que la interfaz recibe, no cómo se consulta.
 */

import type { EstadoCuenta } from '../permissions/acceso'
import type { Rol } from '../permissions/roles'

export interface CuentaConRoles {
  id: string
  email: string | null
  fullName: string | null
  status: EstadoCuenta
  roles: Rol[]
}

export interface Administrador {
  id: string
  email: string | null
  fullName: string | null
  status: EstadoCuenta
  /** Identificadores de las propiedades con asignación vigente. */
  propiedades: string[]
}
