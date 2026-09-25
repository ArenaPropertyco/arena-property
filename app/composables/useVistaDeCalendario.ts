export type VistaDeCalendario = 'lista' | 'almanaque'

const UN_ANIO = 60 * 60 * 24 * 365

/**
 * RT-06 · cómo prefiere ver el año quien mira: la lista vertical por semanas o
 * el almanaque de doce meses. La preferencia es de la persona, no de la página:
 * vale igual en «Mi calendario» del Propietario y en el tablero del
 * Administrador, y sobrevive a la sesión en una cookie, como el tema.
 */
export function useVistaDeCalendario() {
  const vista = useCookie<VistaDeCalendario>('arena_vista_calendario', { default: () => 'lista', maxAge: UN_ANIO, sameSite: 'lax' })
  const almanaque = computed({
    get: () => vista.value === 'almanaque',
    set: (valor: boolean) => {
      vista.value = valor ? 'almanaque' : 'lista'
    },
  })
  return { vista, almanaque }
}
