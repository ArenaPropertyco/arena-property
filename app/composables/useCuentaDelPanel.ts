import type { ComputedRef, InjectionKey } from 'vue'
import type { Rol } from '#shared/permissions/roles'

/**
 * La identidad de quien usa el panel, del layout hacia abajo.
 *
 * La barra superior vive dentro de `PanelPage`, que a su vez vive dentro de cada
 * página: entre el layout —el único que consulta la cuenta— y esa barra hay una capa
 * que no controlamos. Este puente la salva sin obligar a cada página a repetir el
 * mismo bloque, y sin que ningún componente consulte datos por su cuenta (principio 10).
 */
export interface CuentaDelPanel {
  nombre: string
  email: string | null
  roles: readonly Rol[]
}

export interface PuenteDeCuenta {
  /** `null` mientras el perfil no ha cargado: sin identidad no se pinta el menú. */
  cuenta: ComputedRef<CuentaDelPanel | null>
  salir: () => Promise<void>
}

export const CLAVE_CUENTA_DEL_PANEL: InjectionKey<PuenteDeCuenta> = Symbol('cuenta-del-panel')

/** Lo llama el layout del panel, que es quien tiene la cuenta cargada. */
export function proveerCuentaDelPanel(puente: PuenteDeCuenta): void {
  provide(CLAVE_CUENTA_DEL_PANEL, puente)
}

/**
 * Lo llama la barra superior. Devuelve `null` fuera del panel —en una prueba que
 * monta el componente suelto, por ejemplo— para que el menú simplemente no aparezca
 * en vez de romper la vista.
 */
export function useCuentaDelPanel(): PuenteDeCuenta | null {
  return inject(CLAVE_CUENTA_DEL_PANEL, null)
}
