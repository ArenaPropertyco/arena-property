/**
 * HU-47 · RF-47.3, RF-47.4 · RT-05 — los dos correos de la lista de espera en
 * los dos idiomas: la confirmación al inscribirse y el aviso cuando se libera
 * una fracción. Viven aquí y no en `i18n/locales` porque los consume Nitro, que
 * no tiene el runtime de vue-i18n; se prueban por contrato como los de TR-03.
 */

import type { Idioma } from '../notifications/plantillas'

export type CorreoDeListaDeEspera = 'confirmation' | 'release'

export interface PlantillaDeListaDeEspera {
  asunto: string
  texto: string
}

type Textos = { asunto: string, texto: string }

const PLANTILLAS: Record<CorreoDeListaDeEspera, Record<Idioma, Textos>> = {
  confirmation: {
    es: {
      asunto: 'Estás en la lista de espera de {property_name}',
      texto: 'Hola {full_name},\n\nQuedaste anotado en la lista de espera de {property_name}. Cuando una fracción vuelva a estar disponible te avisaremos a este correo, en orden de inscripción.\n\nGuardamos tus datos con tu consentimiento durante cinco años y después los anonimizamos.\n\nArena Property',
    },
    en: {
      asunto: 'You are on the waiting list for {property_name}',
      texto: 'Hi {full_name},\n\nYou have been added to the waiting list for {property_name}. When a fraction becomes available again we will email you here, in order of enrolment.\n\nWe keep your details with your consent for five years and anonymise them afterwards.\n\nArena Property',
    },
  },
  release: {
    es: {
      asunto: 'Se liberó una fracción en {property_name}',
      texto: 'Hola {full_name},\n\nUna fracción de {property_name} volvió a estar disponible. Estabas en la lista de espera: si te interesa, escríbenos cuanto antes desde la ficha de la propiedad.\n\n{property_url}\n\nArena Property',
    },
    en: {
      asunto: 'A fraction at {property_name} is available again',
      texto: 'Hi {full_name},\n\nA fraction at {property_name} is available again. You were on the waiting list: if you are interested, contact us as soon as possible from the property page.\n\n{property_url}\n\nArena Property',
    },
  },
}

/** Sustituye `{campo}` por la carga; lo que falte queda vacío, nunca un marcador suelto. */
function interpolar(texto: string, carga: Record<string, unknown>): string {
  return texto.replace(/\{([a-z_]+)\}/g, (_, campo: string) => {
    const valor = carga[campo]
    return valor === null || valor === undefined ? '' : String(valor)
  })
}

export function plantillaDeListaDeEspera(
  tipo: CorreoDeListaDeEspera,
  idioma: Idioma,
  carga: Record<string, unknown>,
): PlantillaDeListaDeEspera {
  const textos = PLANTILLAS[tipo][idioma]
  return { asunto: interpolar(textos.asunto, carga), texto: interpolar(textos.texto, carga) }
}
