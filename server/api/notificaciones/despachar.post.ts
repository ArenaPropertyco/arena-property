/**
 * TR-03 · RF-N.2, RF-N.6 — despacho del correo pendiente.
 *
 * Lo invoca un programador externo (una función programada de Netlify o un cron)
 * con el token de despacho en cabecera. No recibe datos: toma lo pendiente de la
 * base, intenta cada correo y registra el resultado. Un fallo del proveedor nunca
 * responde error: queda anotado para reintentar. En la misma pasada entrega los
 * avisos de la lista de espera (HU-47 · RF-47.4), que siguen el mismo ciclo.
 */
import { despacharAvisosDeListaDeEspera } from '../../utils/lista-de-espera'
import { despacharCorreos } from '../../utils/notificaciones'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getHeader(event, 'x-dispatch-token') ?? ''

  if (!config.notificationsDispatchToken) {
    throw createError({ statusCode: 503, statusMessage: 'notifications.errors.dispatch_not_configured' })
  }
  if (token !== config.notificationsDispatchToken) {
    throw createError({ statusCode: 401, statusMessage: 'notifications.errors.dispatch_unauthorized' })
  }

  const notificaciones = await despacharCorreos(event)
  const listaDeEspera = await despacharAvisosDeListaDeEspera(event)
  return { ...notificaciones, listaDeEspera }
})
