<script setup lang="ts">
import type { CambioDeContrasena, DatosDeCuenta } from '#shared/identity/edicion-de-perfil'

/**
 * Perfil de la propia cuenta, desde el menú de cuenta: cualquier rol lo abre.
 *
 * La página orquesta: los datos (todo menos el correo, que es la llave de acceso)
 * y la contraseña, que se cambia dando la actual o, si la cuenta nació con Google,
 * se crea. Cambiar el idioma del perfil cambia también el de la interfaz.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t, locale, setLocale } = useI18n()
const toast = useToast()
const { perfil, tieneContrasena, pendiente, guardar, cambiarContrasena } = usePerfil()

const guardando = ref(false)
const cambiando = ref(false)
const formularioDeContrasena = ref<{ limpiar: () => void } | null>(null)

async function guardarPerfil(datos: DatosDeCuenta) {
  guardando.value = true
  const resultado = await guardar(datos)
  guardando.value = false
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  toast.add({ title: t('profile.saved'), color: 'success' })
  if (datos.locale !== locale.value) {
    await setLocale(datos.locale as 'es' | 'en')
  }
}

async function guardarContrasena(datos: CambioDeContrasena) {
  const creada = !tieneContrasena.value
  cambiando.value = true
  const resultado = await cambiarContrasena(datos)
  cambiando.value = false
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  formularioDeContrasena.value?.limpiar()
  toast.add({ title: t(creada ? 'profile.password.created' : 'profile.password.changed'), color: 'success' })
}
</script>

<template>
  <PanelPage
    :titulo="t('profile.title')"
    :subtitulo="t('profile.subtitle')"
  >
    <div class="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <PanelCollapsible
        nombre="datos"
        :titulo="t('profile.dataTitle')"
        :descripcion="t('profile.dataHint')"
        icono="i-lucide-user-round"
        abierta-al-inicio
      >
        <ProfileForm
          v-if="perfil"
          :key="perfil.email ?? ''"
          :datos="perfil"
          :avatar-url="perfil.avatarUrl"
          :enviando="guardando"
          @submit="guardarPerfil"
        />
        <p
          v-else-if="!pendiente"
          class="text-sm text-muted"
        >
          {{ t('profile.errors.load_failed') }}
        </p>
      </PanelCollapsible>

      <PanelCollapsible
        nombre="contrasena"
        :titulo="tieneContrasena ? t('profile.password.title') : t('profile.password.createTitle')"
        :descripcion="tieneContrasena ? t('profile.password.changeHint') : t('profile.password.createHint')"
        icono="i-lucide-key-round"
      >
        <PasswordForm
          ref="formularioDeContrasena"
          :tiene-contrasena="tieneContrasena"
          :enviando="cambiando"
          @submit="guardarContrasena"
        />
      </PanelCollapsible>
    </div>
  </PanelPage>
</template>
